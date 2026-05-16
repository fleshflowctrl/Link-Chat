/**
 * Credit economy — base pack: €9.99 for 100 credits (€0.0999/credit).
 * Chat message: €0.30 → 3 credits at base rate.
 */

export const BASE_PACK_CREDITS = 100;
export const BASE_PACK_PRICE_EUR = 9.99;

/** Credits per euro at the standard 100-credit pack rate. */
export const CREDITS_PER_EURO = BASE_PACK_CREDITS / BASE_PACK_PRICE_EUR;

/** New accounts start with one full base pack worth of credits. */
export const STARTING_USER_CREDITS = 100;

/** Outgoing chat text or image — €0.30 at base pack rate. */
export const CHAT_MESSAGE_COST_CREDITS = 3;

/** Skip to next feed slot — ~€2.50 at base rate. */
export const HOURLY_FEED_REFRESH_COST_CREDITS = 25;

/** Default blurred photo unlock when blur_cost is unset — ~€5.00. */
export const DEFAULT_PHOTO_UNLOCK_COST_CREDITS = 50;

export function euroToCreditsAtBaseRate(euro: number): number {
  return Math.round(euro * CREDITS_PER_EURO);
}

export function creditsToEuroAtBaseRate(credits: number): number {
  return (credits * BASE_PACK_PRICE_EUR) / BASE_PACK_CREDITS;
}
