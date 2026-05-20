import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PRO_SUBSCRIPTION_CREDITS_PER_MONTH,
  PRO_SUBSCRIPTION_MIN_MONTHS,
  addMonthsUtc,
} from "@/lib/credits/pro-subscription";

export type ActivateProSubscriptionInput = {
  userId: string;
  stripeSubscriptionId: string;
  stripeCustomerId?: string | null;
  startedAt?: Date;
};

export type FulfillProInvoiceInput = {
  userId: string;
  stripeInvoiceId: string;
  stripeSubscriptionId: string;
};

export type ProFulfillResult =
  | {
      ok: true;
      alreadyFulfilled: boolean;
      balance: number;
      grantedCredits: number;
    }
  | { ok: false; error: string };

export async function activateProSubscription(
  service: SupabaseClient,
  input: ActivateProSubscriptionInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const startedAt = input.startedAt ?? new Date();
  const minimumEnd = addMonthsUtc(startedAt, PRO_SUBSCRIPTION_MIN_MONTHS);

  const patch: Record<string, unknown> = {
    pro_stripe_subscription_id: input.stripeSubscriptionId,
    pro_status: "active",
    pro_started_at: startedAt.toISOString(),
    pro_minimum_end_at: minimumEnd.toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (input.stripeCustomerId) {
    patch.pro_stripe_customer_id = input.stripeCustomerId;
  }

  const { error } = await service
    .from("user_profiles")
    .update(patch)
    .eq("user_id", input.userId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Grant one month of Pro credits. Idempotent per Stripe invoice id.
 */
export async function fulfillProSubscriptionInvoice(
  service: SupabaseClient,
  input: FulfillProInvoiceInput,
): Promise<ProFulfillResult> {
  const { data: existing } = await service
    .from("pro_subscription_grants")
    .select("user_id, granted_credits")
    .eq("stripe_invoice_id", input.stripeInvoiceId)
    .maybeSingle();

  if (existing) {
    const row = existing as { user_id: string; granted_credits: number };
    if (row.user_id !== input.userId) {
      return { ok: false, error: "invoice belongs to another user" };
    }
    const profile = await readCredits(service, input.userId);
    if (!profile.ok) return profile;
    return {
      ok: true,
      alreadyFulfilled: true,
      balance: profile.credits,
      grantedCredits: row.granted_credits,
    };
  }

  const profile = await readCredits(service, input.userId);
  if (!profile.ok) return profile;

  const grantedCredits = PRO_SUBSCRIPTION_CREDITS_PER_MONTH;
  const newBalance = profile.credits + grantedCredits;

  const { error: insErr } = await service.from("pro_subscription_grants").insert({
    user_id: input.userId,
    stripe_invoice_id: input.stripeInvoiceId,
    stripe_subscription_id: input.stripeSubscriptionId,
    granted_credits: grantedCredits,
  });

  if (insErr) {
    if (insErr.code === "23505") {
      const again = await readCredits(service, input.userId);
      if (!again.ok) return again;
      return {
        ok: true,
        alreadyFulfilled: true,
        balance: again.credits,
        grantedCredits,
      };
    }
    return { ok: false, error: insErr.message };
  }

  const { error: updErr } = await service
    .from("user_profiles")
    .update({
      credits: newBalance,
      pro_stripe_subscription_id: input.stripeSubscriptionId,
      pro_status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", input.userId);

  if (updErr) return { ok: false, error: updErr.message };

  return {
    ok: true,
    alreadyFulfilled: false,
    balance: newBalance,
    grantedCredits,
  };
}

async function readCredits(
  service: SupabaseClient,
  userId: string,
): Promise<
  | { ok: true; credits: number }
  | { ok: false; error: string }
> {
  const { data, error } = await service
    .from("user_profiles")
    .select("credits")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  const row = data as { credits?: number } | null;
  return {
    ok: true,
    credits:
      typeof row?.credits === "number" && row.credits >= 0 ? row.credits : 0,
  };
}
