/** User-facing wallet copy — internal APIs/DB still use "credits". */

import { POINTS_PER_MESSAGE } from "@/lib/credits/pricing";

export const BUNDLES_TITLE = "Gesprekken";
export const BUNDLES_SUBTITLE =
  "Kies hoeveel berichten je wilt versturen. Geen abonnement, gewoon verder chatten.";
export const BUNDLE_TITLE_SINGULAR = "Berichtenbundel";
export const POINTS_LABEL = "Beright punten";

export function creditsToMessages(credits: number): number {
  return Math.max(0, Math.floor(credits / POINTS_PER_MESSAGE));
}

export function bundleMessagesLabel(credits: number): string {
  const n = creditsToMessages(credits);
  return n === 1 ? "1 bericht" : `${n.toLocaleString("nl-NL")} berichten`;
}

export function bundleMessagesAdded(credits: number): string {
  const n = creditsToMessages(credits);
  return `+${n.toLocaleString("nl-NL")} berichten`;
}

export function bundleBonusMessagesLabel(bonusCredits: number): string {
  const n = creditsToMessages(bonusCredits);
  return n === 1 ? "+1 extra bericht" : `+${n.toLocaleString("nl-NL")} extra berichten`;
}

export function bundleMessagesTotalLabel(credits: number, bonus: number): string {
  return bundleMessagesLabel(credits + bonus);
}

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
