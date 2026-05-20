import { SIGNUP_ACCOUNT_CREDITS } from "@/lib/credits/pricing";
import { getServiceSupabase } from "@/lib/supabase/admin";

/**
 * One-time balance when a guest/anonymous user becomes a permanent account.
 * Uses service role so it works even before email confirmation.
 */
export async function grantSignupCreditsForUser(
  userId: string,
): Promise<{ ok: true; credits: number } | { ok: false; error: string }> {
  const admin = getServiceSupabase();
  if (!admin) {
    return { ok: false, error: "Service role ontbreekt" };
  }

  const credits = SIGNUP_ACCOUNT_CREDITS;
  const now = new Date().toISOString();

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
