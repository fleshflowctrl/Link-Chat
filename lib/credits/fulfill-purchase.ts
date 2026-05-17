import type { SupabaseClient } from "@supabase/supabase-js";
import { packages } from "@/data/credits";
import {
  applyDiscount,
  discountForNextPurchase,
} from "@/lib/credits/discount";

export type FulfillPurchaseInput = {
  userId: string;
  packageId: string;
  stripeCheckoutSessionId?: string | null;
  /** When set, uses this amount instead of recomputing from current tier. */
  purchaseCountBefore?: number;
};

export type FulfillPurchaseResult =
  | {
      ok: true;
      alreadyFulfilled: boolean;
      balance: number;
      purchaseCount: number;
      grantedCredits: number;
      paid: number;
      discount: number;
    }
  | { ok: false; error: string };

/**
 * Grants credits for a package once. Idempotent when `stripeCheckoutSessionId`
 * is provided (unique constraint on credit_purchases).
 */
export async function fulfillCreditPurchase(
  service: SupabaseClient,
  input: FulfillPurchaseInput,
): Promise<FulfillPurchaseResult> {
  const pkg = packages.find((p) => p.id === input.packageId);
  if (!pkg) {
    return { ok: false, error: "unknown package" };
  }

  if (input.stripeCheckoutSessionId) {
    const { data: existing } = await service
      .from("credit_purchases")
      .select("user_id, granted_credits")
      .eq("stripe_checkout_session_id", input.stripeCheckoutSessionId)
      .maybeSingle();

    if (existing) {
      const row = existing as { user_id: string };
      if (row.user_id !== input.userId) {
        return { ok: false, error: "session belongs to another user" };
      }
      const profile = await readProfile(service, input.userId);
      if (!profile.ok) return profile;
      const discount = discountForNextPurchase(
        Math.max(0, profile.purchaseCount - 1),
      );
      const paid = applyDiscount(pkg.price, discount);
      return {
        ok: true,
        alreadyFulfilled: true,
        balance: profile.credits,
        purchaseCount: profile.purchaseCount,
        grantedCredits: pkg.credits + pkg.bonus,
        paid,
        discount,
      };
    }
  }

  const profile = await readProfile(service, input.userId);
  if (!profile.ok) return profile;

  const countBefore =
    typeof input.purchaseCountBefore === "number" &&
    input.purchaseCountBefore >= 0
      ? input.purchaseCountBefore
      : profile.purchaseCount;

  if (profile.purchaseCount > countBefore) {
    const discount = discountForNextPurchase(
      Math.max(0, profile.purchaseCount - 1),
    );
    return {
      ok: true,
      alreadyFulfilled: true,
      balance: profile.credits,
      purchaseCount: profile.purchaseCount,
      grantedCredits: pkg.credits + pkg.bonus,
      paid: applyDiscount(pkg.price, discount),
      discount,
    };
  }

  const discount = discountForNextPurchase(countBefore);
  const paid = applyDiscount(pkg.price, discount);
  const grantedCredits = pkg.credits + pkg.bonus;
  const newBalance = profile.credits + grantedCredits;
  const newCount = countBefore + 1;
  const amountCents = Math.round(paid * 100);

  if (input.stripeCheckoutSessionId) {
    const { error: insErr } = await service.from("credit_purchases").insert({
      user_id: input.userId,
      package_id: pkg.id,
      stripe_checkout_session_id: input.stripeCheckoutSessionId,
      amount_cents: amountCents,
      granted_credits: grantedCredits,
      purchase_count_before: countBefore,
      discount_applied: discount,
    });

    if (insErr) {
      if (insErr.code === "23505") {
        const again = await readProfile(service, input.userId);
        if (!again.ok) return again;
        return {
          ok: true,
          alreadyFulfilled: true,
          balance: again.credits,
          purchaseCount: again.purchaseCount,
          grantedCredits,
          paid,
          discount,
        };
      }
      return { ok: false, error: insErr.message };
    }
  }

  const { error: updErr } = await service
    .from("user_profiles")
    .update({
      credits: newBalance,
      purchase_count: newCount,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", input.userId);

  if (updErr) {
    return { ok: false, error: updErr.message };
  }

  return {
    ok: true,
    alreadyFulfilled: false,
    balance: newBalance,
    purchaseCount: newCount,
    grantedCredits,
    paid,
    discount,
  };
}

async function readProfile(
  service: SupabaseClient,
  userId: string,
): Promise<
  | { ok: true; credits: number; purchaseCount: number }
  | { ok: false; error: string }
> {
  const { data, error } = await service
    .from("user_profiles")
    .select("credits, purchase_count")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };

  const row = data as { credits?: number; purchase_count?: number } | null;
  return {
    ok: true,
    credits:
      typeof row?.credits === "number" && row.credits >= 0 ? row.credits : 0,
    purchaseCount:
      typeof row?.purchase_count === "number" && row.purchase_count >= 0
        ? row.purchase_count
        : 0,
  };
}
