import type { SupabaseClient } from "@supabase/supabase-js";

/** Source of the checkout click (Stripe redirect vs local dev purchase). */
export type CheckoutClickSource = "stripe" | "dev";

type RecordInput = {
  userId: string;
  packageId: string;
  amountCents: number;
  discount: number;
  purchaseCountBefore: number;
  source: CheckoutClickSource;
};

/**
 * Best-effort log of a credits checkout button click. Never throws — we
 * don't want a failed insert to block the actual checkout flow.
 */
export async function recordCheckoutClick(
  service: SupabaseClient,
  input: RecordInput,
): Promise<void> {
  try {
    const { error } = await service.from("credit_checkout_clicks").insert({
      user_id: input.userId,
      package_id: input.packageId,
      amount_cents: Math.max(0, Math.floor(input.amountCents)),
      discount: input.discount,
      purchase_count_before: Math.max(0, Math.floor(input.purchaseCountBefore)),
      source: input.source,
    });
    if (error) {
      console.warn("[credit_checkout_clicks insert]", error.message);
    }
  } catch (e) {
    console.warn(
      "[credit_checkout_clicks insert]",
      e instanceof Error ? e.message : e,
    );
  }
}
