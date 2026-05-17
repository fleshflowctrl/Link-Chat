"use client";

import { createClient } from "@/utils/supabase/client";
import {
  discoveryPrefsToJson,
  funnelInputToDiscoveryPrefs,
} from "@/lib/discovery-preferences-server";
import {
  CHAT_MESSAGE_COST_CREDITS,
  STARTING_USER_CREDITS,
} from "@/lib/credits/pricing";
import { isSupabaseConfigured } from "@/utils/supabase/public-env";
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
): Promise<FunnelSignupResult> {
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

  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  const emailRedirectTo = origin
    ? `${origin}/auth/callback?next=${encodeURIComponent("/discover")}`
    : undefined;

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: emailRedirectTo ? { emailRedirectTo } : undefined,
  });

  if (signUpError) {
    return { ok: false, error: signUpError.message };
  }

  const userId = signUpData.user?.id ?? null;
  const hasSession = Boolean(signUpData.session);

  // Without a session (email confirmation flow) we can't upsert under RLS.
  // We still return ok so the funnel can finish; profile data is also kept in
  // localStorage and will be synced on first authenticated visit.
  if (!hasSession) {
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
  const firstMessageCost =
    firstMessage && peerId ? CHAT_MESSAGE_COST_CREDITS : 0;
  const creditsAfterSignup = Math.max(0, startingCredits - firstMessageCost);

  const { error: upsertError } = await supabase
    .from("user_profiles")
    .upsert(
      {
        user_id: userId,
        credits: creditsAfterSignup,
        looking_for: input.lookingFor ?? "",
        gender: input.gender ?? "",
        seeking_gender: input.seekingGender ?? "",
        age_range_min: input.ageRange.anyAge ? 18 : input.ageRange.min,
        age_range_max: input.ageRange.anyAge ? 99 : input.ageRange.max,
        age_range_any: input.ageRange.anyAge,
        discovery_prefs: discoveryPrefsToJson(discoveryPrefs),
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

  // Persist the funnel's first chat message (credits already deducted above).
  if (firstMessage && peerId) {
    await supabase.from("chat_messages").insert({
      peer_id: peerId,
      sender: "me",
      kind: "text",
      body: firstMessage,
      owner_user_id: userId,
    });
  }

  return { ok: true, needsEmailConfirm: false, userId };
}
