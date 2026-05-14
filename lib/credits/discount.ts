/**
 * First-time-buyer tiered discount on credit packs.
 *
 *   1st purchase  → 80% off
 *   2nd purchase  → 50% off
 *   3rd purchase  → 20% off
 *   4th+ purchase → full price
 *
 * Counts are zero-indexed: `purchaseCount` of 0 means "user has never bought
 * before", so their next purchase qualifies for the 80% deal.
 */
export const DISCOUNT_TIERS: readonly number[] = [0.8, 0.5, 0.2] as const;

/** Discount fraction (0..1) for the user's NEXT purchase given how many they've already done. */
export function discountForNextPurchase(purchaseCount: number): number {
  if (!Number.isFinite(purchaseCount) || purchaseCount < 0) return DISCOUNT_TIERS[0];
  if (purchaseCount >= DISCOUNT_TIERS.length) return 0;
  return DISCOUNT_TIERS[purchaseCount];
}

/** Apply a discount to a price, rounded to 2 decimals. */
export function applyDiscount(price: number, discount: number): number {
  if (!discount || discount <= 0) return price;
  if (discount >= 1) return 0;
  return Math.round(price * (1 - discount) * 100) / 100;
}

/** "80%" / "50%" — already-rounded human-readable label. */
export function formatDiscountPercent(discount: number): string {
  return `${Math.round(discount * 100)}%`;
}

/** "1e aankoop" / "2e aankoop" / "3e aankoop" / null when no discount applies. */
export function purchaseTierLabel(purchaseCount: number): string | null {
  if (purchaseCount === 0) return "1e aankoop";
  if (purchaseCount === 1) return "2e aankoop";
  if (purchaseCount === 2) return "3e aankoop";
  return null;
}
