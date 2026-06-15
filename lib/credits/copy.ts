/** User-facing wallet copy — internal APIs/DB still use "credits". */

import { POINTS_PER_MESSAGE } from "@/lib/credits/pricing";

export const BUNDLES_TITLE = "Berichtenbundels";
export const BUNDLE_TITLE_SINGULAR = "Berichtenbundel";
export const POINTS_LABEL = "Beright punten";

export function bundleUnits(amount: number): string {
  return `${amount.toLocaleString("nl-NL")} ${POINTS_LABEL}`;
}

export function bundleUnitsAdded(amount: number): string {
  return `+${amount.toLocaleString("nl-NL")} ${POINTS_LABEL}`;
}

export function bundleBonusUnits(amount: number): string {
  return `+${amount.toLocaleString("nl-NL")} bonus ${POINTS_LABEL.toLowerCase()}`;
}

export function bundleRewardUnits(amount: number): string {
  return `+${amount.toLocaleString("nl-NL")} ${POINTS_LABEL}`;
}

export const BUY_BUNDLES_CTA = "Berichtenbundels kopen";
export const BACK_TO_BUNDLES_ARIA = "Terug naar Berichtenbundels";

export function notEnoughBundleMessage(cost?: number): string {
  if (typeof cost === "number" && cost > 0) {
    return `Niet genoeg ${POINTS_LABEL.toLowerCase()} (${cost.toLocaleString("nl-NL")} nodig)`;
  }
  return `Niet genoeg ${POINTS_LABEL.toLowerCase()}`;
}

export function notEnoughForMessageCost(
  costPerMessage: number = POINTS_PER_MESSAGE,
): string {
  return `Niet genoeg ${POINTS_LABEL.toLowerCase()} (${costPerMessage.toLocaleString("nl-NL")} per bericht).`;
}

export function insufficientBundleWithCost(cost: number): string {
  return `Te weinig ${POINTS_LABEL.toLowerCase()} (${cost.toLocaleString("nl-NL")} nodig)`;
}

export function unlockForUnits(cost: number): string {
  return `Ontgrendel voor ${bundleUnits(cost)}`;
}

export function bundleTotalUnits(credits: number, bonus: number): string {
  return bundleUnits(credits + bonus);
}

export function bundleBonusPercent(credits: number, bonus: number): number {
  if (credits <= 0 || bonus <= 0) return 0;
  return Math.round((bonus / credits) * 100);
}
