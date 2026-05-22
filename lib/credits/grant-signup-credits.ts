import { SIGNUP_ACCOUNT_CREDITS } from "@/lib/credits/pricing";
import { getServiceSupabase } from "@/lib/supabase/admin";

/**
 * Bonus when a guest/anonymous user becomes a permanent account (+100 on top of
 * existing balance). Uses service role so it works even before email confirmation.
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

  const current =
    typeof existing?.credits === "number" && existing.credits >= 0
      ? existing.credits
      : 0;
  const credits = current + SIGNUP_ACCOUNT_CREDITS;

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
