/**
 * Credit economy — base pack: €19.99 for 1000 credits.
 * Chat message: €0.30 → 30 credits at base rate.
 */

export const BASE_PACK_CREDITS = 1000;
export const BASE_PACK_PRICE_EUR = 19.99;

/** Credits per euro at the standard 1000-credit pack rate. */
export const CREDITS_PER_EURO = BASE_PACK_CREDITS / BASE_PACK_PRICE_EUR;

/** New accounts start with this balance (DB default matches). */
export const STARTING_USER_CREDITS = 150;

/** Bonus credits added when a guest registers a permanent account (on top of balance). */
export const SIGNUP_ACCOUNT_CREDITS = 100;

/** Outgoing chat text or image — €0.30 at base pack rate. */
export const CHAT_MESSAGE_COST_CREDITS = 30;

/** Skip to next feed slot (v1) — ~€2.60 at base rate. */
export const HOURLY_FEED_REFRESH_COST_CREDITS = 260;

/** Skip to next feed slot (v2 discover only) — ~€2.00 at base rate. */
export const V2_HOURLY_FEED_REFRESH_COST_CREDITS = 200;

/** Default blurred photo unlock when blur_cost is unset — ~€5.00. */
export const DEFAULT_PHOTO_UNLOCK_COST_CREDITS = 500;

export function euroToCreditsAtBaseRate(euro: number): number {
  return Math.round(euro * CREDITS_PER_EURO);
}

export function creditsToEuroAtBaseRate(credits: number): number {
  return (credits * BASE_PACK_PRICE_EUR) / BASE_PACK_CREDITS;
}
