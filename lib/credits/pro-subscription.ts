/** Pro subscription — special offer on the credits page (v1 + v2). */

export const PRO_SUBSCRIPTION_PLAN_ID = "pro_monthly";

export const PRO_SUBSCRIPTION_CREDITS_PER_MONTH = 1000;

export const PRO_SUBSCRIPTION_PRICE_EUR = 14.99;

/** Minimum contract length shown in checkout copy. */
export const PRO_SUBSCRIPTION_MIN_MONTHS = 12;

/** One-time 1000 pack price for comparison strikethrough. */
export const PRO_SUBSCRIPTION_COMPARE_PRICE_EUR = 19.99;

export function proSubscriptionAmountCents(): number {
  return Math.round(PRO_SUBSCRIPTION_PRICE_EUR * 100);
}

export function addMonthsUtc(from: Date, months: number): Date {
  const d = new Date(from.getTime());
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}
