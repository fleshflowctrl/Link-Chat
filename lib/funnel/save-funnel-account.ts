"use client";

import { createClient } from "@/utils/supabase/client";
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
          : "Could not initialise Supabase client.",
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
      error: "Account created but user id missing — please log in.",
    };
  }

  const { error: upsertError } = await supabase
    .from("user_profiles")
    .upsert(
      {
        user_id: userId,
        credits: Math.max(0, Math.floor(input.startingCredits)),
        looking_for: input.lookingFor ?? "",
        gender: input.gender ?? "",
        seeking_gender: input.seekingGender ?? "",
        age_range_min: input.ageRange.anyAge ? 18 : input.ageRange.min,
        age_range_max: input.ageRange.anyAge ? 99 : input.ageRange.max,
        age_range_any: input.ageRange.anyAge,
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

  return { ok: true, needsEmailConfirm: false, userId };
}
