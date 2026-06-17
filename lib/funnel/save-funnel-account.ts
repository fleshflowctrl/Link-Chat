"use client";

import { createClient } from "@/utils/supabase/client";
import {
  discoveryPrefsToJson,
  funnelInputToDiscoveryPrefs,
} from "@/lib/discovery-preferences-server";
import { deductUserCredits, refundUserCredits } from "@/lib/credits/deduct";
import {
  CHAT_MESSAGE_COST_CREDITS,
  STARTING_USER_CREDITS,
} from "@/lib/credits/pricing";
import { mapSupabaseAuthError } from "@/lib/auth/error-messages";
import { isSupabaseConfigured } from "@/utils/supabase/public-env";
import type { AppVariant } from "@/lib/app-variant";
import { DEFAULT_APP_VARIANT, withVariantPath } from "@/lib/app-variant";
import { convertAnonymousToPermanentAccount } from "@/lib/auth/guest-session";
import { trackSignupLink } from "@/lib/analytics/visitor-id";
import {
  fireAffiliateSignupConversion,
  getStoredAffiliateClickId,
} from "@/lib/affiliate/911-for-me";
import type {
  FunnelAgeRange,
  FunnelLookingFor,
} from "@/data/funnel";

export type FunnelGender = "man" | "woman";
export type FunnelSeekingGender = "men" | "women" | "both";

export type FunnelSignupInput = {
  email: string;
  password: string;
  lookingFor: FunnelLookingFor | null;
  gender: FunnelGender | null;
  seekingGender: FunnelSeekingGender | null;
  ageRange: FunnelAgeRange;
  startingCredits: number;
  pickedMatchId?: string | null;
  /** First chat message the user composed in the funnel, persisted so their inbox is non-empty. */
  firstMessage?: string | null;
};

export type FunnelSignupResult =
  | { ok: true; needsEmailConfirm: boolean; userId: string | null }
  | { ok: false; error: string };

/**
 * Sign the user up via Supabase auth and immediately upsert their funnel data
 * into `user_profiles`. If Supabase is not configured (local dev without env),
 * we treat this as a successful no-op so the rest of the funnel keeps working.
 */
export async function saveFunnelAccount(
  input: FunnelSignupInput,
  options: { variant?: AppVariant } = {},
): Promise<FunnelSignupResult> {
  const variant = options.variant ?? DEFAULT_APP_VARIANT;
  const discoverPath = withVariantPath("/discover", variant);
  if (!isSupabaseConfigured()) {
    return { ok: true, needsEmailConfirm: false, userId: null };
  }

  let supabase;
  try {
    supabase = createClient();
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "Kon geen verbinding maken met de server.",
    };
  }

  const email = input.email.trim();
  const password = input.password;

  const {
    data: { user: existingUser },
  } = await supabase.auth.getUser();

  let userId: string | null = null;
  let hasSession = false;
  let needsEmailConfirmFromAuth = false;

  const isGuest =
    existingUser?.is_anonymous === true ||
    existingUser?.user_metadata?.is_funnel_guest === true;

  if (isGuest) {
    const converted = await convertAnonymousToPermanentAccount({
      email,
      password,
      affiliateClickId: getStoredAffiliateClickId(),
    });
    if (!converted.ok) {
      return { ok: false, error: mapSupabaseAuthError(converted.error) };
    }
    userId = converted.userId;
    hasSession = !converted.needsEmailConfirm;
    needsEmailConfirmFromAuth = converted.needsEmailConfirm;
  } else {
    const signupRes = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        email,
        password,
        next: discoverPath,
        affiliateClickId: getStoredAffiliateClickId(),
      }),
    });

    const signupData = (await signupRes.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      userId?: string;
      access_token?: string;
      refresh_token?: string;
    };

    if (!signupRes.ok || !signupData.ok) {
      return {
        ok: false,
        error:
          signupData.error ??
          mapSupabaseAuthError(`Registreren mislukt (${signupRes.status})`),
      };
    }

    userId = signupData.userId ?? null;
    if (signupData.access_token && signupData.refresh_token) {
      const { error: sessionErr } = await supabase.auth.setSession({
        access_token: signupData.access_token,
        refresh_token: signupData.refresh_token,
      });
      if (sessionErr) {
        return { ok: false, error: mapSupabaseAuthError(sessionErr.message) };
      }
      hasSession = true;
      needsEmailConfirmFromAuth = false;
    } else {
      const { data: signIn, error: signInErr } =
        await supabase.auth.signInWithPassword({ email, password });
      if (signInErr || !signIn.session) {
        return {
          ok: false,
          error: mapSupabaseAuthError(
            signInErr?.message ?? "Inloggen na registratie mislukt",
          ),
        };
      }
      hasSession = true;
      needsEmailConfirmFromAuth = false;
    }
  }

  // Link the anonymous visitor (localStorage UUID) to this brand-new auth
  // user so the admin metrics page can compute visitor → signup funnel.
  // Best-effort; never blocks signup completion.
  void trackSignupLink(userId, variant);
  fireAffiliateSignupConversion({ txid: userId ?? undefined });

  // Without a session (email confirmation flow) we can't upsert under RLS.
  // We still return ok so the funnel can finish; profile data is also kept in
  // localStorage and will be synced on first authenticated visit.
  if (!hasSession || needsEmailConfirmFromAuth) {
    return { ok: true, needsEmailConfirm: true, userId };
  }

  if (!userId) {
    return {
      ok: false,
      error: "Account aangemaakt maar gebruikers-id ontbreekt — log in.",
    };
  }

  const discoveryPrefs = funnelInputToDiscoveryPrefs({
    lookingFor: input.lookingFor,
    seekingGender: input.seekingGender,
    ageRange: input.ageRange,
  });

  const firstMessage = (input.firstMessage ?? "").trim();
  const peerId = (input.pickedMatchId ?? "").trim();
  const startingCredits = Math.max(
    0,
    Math.floor(input.startingCredits ?? STARTING_USER_CREDITS),
  );

  const { data: existingProfile } = await supabase
    .from("user_profiles")
    .select("credits")
    .eq("user_id", userId)
    .maybeSingle();

  const creditsKeep =
    typeof existingProfile?.credits === "number" && existingProfile.credits >= 0
      ? existingProfile.credits
      : startingCredits;

  const { error: upsertError } = await supabase
    .from("user_profiles")
    .upsert(
      {
        user_id: userId,
        credits: creditsKeep,
        looking_for: input.lookingFor ?? "",
        gender: input.gender ?? "",
        seeking_gender: input.seekingGender ?? "",
        age_range_min: input.ageRange.anyAge ? 18 : input.ageRange.min,
        age_range_max: input.ageRange.anyAge ? 99 : input.ageRange.max,
        age_range_any: input.ageRange.anyAge,
        discovery_prefs: discoveryPrefsToJson(discoveryPrefs),
        app_variant: variant,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (upsertError) {
    // Auth user exists; surface profile-save error but don't block the funnel.
    return {
      ok: true,
      needsEmailConfirm: false,
      userId,
    };
  }

  if (firstMessage && peerId) {
    const { data: existingMsg } = await supabase
      .from("chat_messages")
      .select("id")
      .eq("owner_user_id", userId)
      .eq("peer_id", peerId)
      .eq("sender", "me")
      .limit(1)
      .maybeSingle();

    if (!existingMsg) {
      const deduct = await deductUserCredits(
        supabase,
        userId,
        CHAT_MESSAGE_COST_CREDITS,
      );
      if (deduct.ok) {
        const { error: msgErr } = await supabase.from("chat_messages").insert({
          peer_id: peerId,
          sender: "me",
          kind: "text",
          body: firstMessage,
          owner_user_id: userId,
        });
        if (msgErr) {
          await refundUserCredits(supabase, userId, deduct.balanceBefore);
        }
      }
    }
  }

  return { ok: true, needsEmailConfirm: false, userId };
}
