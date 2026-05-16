import type { SupabaseClient } from "@supabase/supabase-js";

export type DeductCreditsResult =
  | { ok: true; balanceBefore: number; newBalance: number }
  | {
      ok: false;
      reason: "insufficient" | "read_failed" | "update_failed";
      balance: number;
      error?: string;
    };

export async function deductUserCredits(
  supabase: SupabaseClient,
  userId: string,
  amount: number,
): Promise<DeductCreditsResult> {
  const cost = Math.max(0, Math.floor(amount));
  if (cost === 0) {
    return { ok: true, balanceBefore: 0, newBalance: 0 };
  }

  const { data: profileRow, error: readErr } = await supabase
    .from("user_profiles")
    .select("credits")
    .eq("user_id", userId)
    .maybeSingle();

  if (readErr) {
    return {
      ok: false,
      reason: "read_failed",
      balance: 0,
      error: readErr.message,
    };
  }

  const balanceBefore =
    profileRow && typeof (profileRow as { credits?: number }).credits === "number"
      ? Math.max(0, (profileRow as { credits: number }).credits)
      : 0;

  if (balanceBefore < cost) {
    return {
      ok: false,
      reason: "insufficient",
      balance: balanceBefore,
    };
  }

  const newBalance = balanceBefore - cost;
  const { error: updErr } = await supabase
    .from("user_profiles")
    .update({ credits: newBalance, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  if (updErr) {
    return {
      ok: false,
      reason: "update_failed",
      balance: balanceBefore,
      error: updErr.message,
    };
  }

  return { ok: true, balanceBefore, newBalance };
}

export async function refundUserCredits(
  supabase: SupabaseClient,
  userId: string,
  balance: number,
): Promise<void> {
  if (!Number.isFinite(balance) || balance < 0) return;
  await supabase
    .from("user_profiles")
    .update({
      credits: Math.floor(balance),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}
