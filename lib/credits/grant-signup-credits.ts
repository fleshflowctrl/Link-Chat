import {
  SIGNUP_ACCOUNT_CREDITS,
  STARTING_USER_CREDITS,
} from "@/lib/credits/pricing";
import { getServiceSupabase } from "@/lib/supabase/admin";

/**
 * Grant 7 free messages (70 credits) when a user creates a permanent account.
 * Unused guest-trial balance (max 50 credits) is preserved on top.
 */
export async function grantSignupCreditsForUser(
  userId: string,
): Promise<{ ok: true; credits: number } | { ok: false; error: string }> {
  const admin = getServiceSupabase();
  if (!admin) {
    return { ok: false, error: "Service role ontbreekt" };
  }

  const now = new Date().toISOString();

  const { data: existing, error: readErr } = await admin
    .from("user_profiles")
    .select("credits")
    .eq("user_id", userId)
    .maybeSingle();

  if (readErr) {
    return { ok: false, error: readErr.message };
  }

  const existingBalance =
    typeof existing?.credits === "number" && existing.credits >= 0
      ? existing.credits
      : 0;
  const guestTrialRemainder = Math.min(existingBalance, STARTING_USER_CREDITS);
  const credits = SIGNUP_ACCOUNT_CREDITS + guestTrialRemainder;

  const { error } = await admin.from("user_profiles").upsert(
    {
      user_id: userId,
      credits,
      updated_at: now,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, credits };
}
