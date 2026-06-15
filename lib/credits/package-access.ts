import type { CreditPackage } from "@/data/credits";

export function canPurchasePackage(
  pkg: CreditPackage,
  purchaseCount: number,
): boolean {
  if (pkg.firstPurchaseOnly) {
    return purchaseCount === 0;
  }
  return true;
}

export const FIRST_PURCHASE_ONLY_ERROR = "first_purchase_only";
