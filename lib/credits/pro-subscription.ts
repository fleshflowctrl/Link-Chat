/** Pro subscription — eenmalige aanbieding on the credits page (v1 + v2). */

import { creditsToEuroAtBaseRate } from "@/lib/credits/pricing";

export const PRO_SUBSCRIPTION_PLAN_ID = "pro_monthly";

export const PRO_SUBSCRIPTION_CREDITS_PER_MONTH = 1500;

export const PRO_SUBSCRIPTION_PRICE_EUR = 14.99;

/** Minimum contract length shown in checkout copy. */
export const PRO_SUBSCRIPTION_MIN_MONTHS = 12;

/** One-time equivalent at base pack rate (strikethrough vs monthly Pro). */
export const PRO_SUBSCRIPTION_COMPARE_PRICE_EUR = creditsToEuroAtBaseRate(
  PRO_SUBSCRIPTION_CREDITS_PER_MONTH,
);

export function proSubscriptionAmountCents(): number {
  return Math.round(PRO_SUBSCRIPTION_PRICE_EUR * 100);
}

export function addMonthsUtc(from: Date, months: number): Date {
  const d = new Date(from.getTime());
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}
