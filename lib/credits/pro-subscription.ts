/** Pro subscription — eenmalige aanbieding on the credits page (v1 + v2). */

import { creditsToEuroAtBaseRate } from "@/lib/credits/pricing";

export const PRO_SUBSCRIPTION_PLAN_ID = "pro_monthly";

/** Stripe catalog — DiscreetNetwerk Pro (monthly). Override in production via env. */
export const PRO_SUBSCRIPTION_STRIPE_PRODUCT_ID_DEFAULT = "prod_UYbAEhUzc8kZoq";
export const PRO_SUBSCRIPTION_STRIPE_PRICE_ID_DEFAULT =
  "price_1TZTydRoFAYFDiXDHhGIjFov";

export const PRO_SUBSCRIPTION_CREDITS_PER_MONTH = 150;

export const PRO_SUBSCRIPTION_PRICE_EUR = 14.99;

/** Minimum contract length before the user may cancel Pro. */
export const PRO_SUBSCRIPTION_MIN_MONTHS = 3;

/** One-time equivalent at base pack rate (strikethrough vs monthly Pro). */
export const PRO_SUBSCRIPTION_COMPARE_PRICE_EUR = creditsToEuroAtBaseRate(
  PRO_SUBSCRIPTION_CREDITS_PER_MONTH,
);

export function proSubscriptionAmountCents(): number {
  return Math.round(PRO_SUBSCRIPTION_PRICE_EUR * 100);
}

/** Stripe Product ID for Pro (optional env: STRIPE_PRO_PRODUCT_ID). */
export function readProSubscriptionStripeProductId(): string {
  const fromEnv = process.env.STRIPE_PRO_PRODUCT_ID?.trim();
  return fromEnv || PRO_SUBSCRIPTION_STRIPE_PRODUCT_ID_DEFAULT;
}

/** Stripe Price ID for Pro checkout (env STRIPE_PRO_PRICE_ID overrides default). */
export function readProSubscriptionStripePriceId(): string {
  const fromEnv = process.env.STRIPE_PRO_PRICE_ID?.trim();
  return fromEnv || PRO_SUBSCRIPTION_STRIPE_PRICE_ID_DEFAULT;
}

/** Savings vs one-time pack price for the same credits (strikethrough compare). */
export function proSubscriptionDiscountPercent(): number {
  const compare = PRO_SUBSCRIPTION_COMPARE_PRICE_EUR;
  if (compare <= 0) return 0;
  const savings = compare - PRO_SUBSCRIPTION_PRICE_EUR;
  if (savings <= 0) return 0;
  return Math.round((savings / compare) * 100);
}

export function addMonthsUtc(from: Date, months: number): Date {
  const d = new Date(from.getTime());
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}
