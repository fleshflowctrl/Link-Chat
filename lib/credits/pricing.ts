/**
 * Beright punten — €2 per chatbericht, 10 punten per bericht.
 * Starterbundel (€19,99) = 100 punten (= 10 berichten).
 */

export const MESSAGE_PRICE_EUR = 2;
export const POINTS_PER_MESSAGE = 10;

export const BASE_PACK_PRICE_EUR = 19.99;
/** Beright punten in de €19,99 starterbundel. */
export const BASE_PACK_CREDITS = 100;

/** Beright punten per euro (≈5 at base pack). */
export const CREDITS_PER_EURO = BASE_PACK_CREDITS / BASE_PACK_PRICE_EUR;

/** New accounts start with this balance (DB default matches). */
export const STARTING_USER_CREDITS = 50;

/** Bonus punten when a guest registers a permanent account. */
export const SIGNUP_ACCOUNT_CREDITS = 30;

/** Outgoing chat text or image — 10 Beright punten (€2). */
export const CHAT_MESSAGE_COST_CREDITS = POINTS_PER_MESSAGE;

/** Skip to next feed slot (v1) — ~€2,60. */
export const HOURLY_FEED_REFRESH_COST_CREDITS = 13;

/** Skip to next feed slot (v2 discover) — €2. */
export const V2_HOURLY_FEED_REFRESH_COST_CREDITS = 10;

/** Default blurred photo unlock when blur_cost is unset — ~€5. */
export const DEFAULT_PHOTO_UNLOCK_COST_CREDITS = 25;

/** Beright punten granted for a pack price (before optional bonus). */
export function pointsForPackPriceEur(priceEur: number): number {
  return Math.round((priceEur / MESSAGE_PRICE_EUR) * POINTS_PER_MESSAGE);
}

export function euroToCreditsAtBaseRate(euro: number): number {
  return Math.round(euro * CREDITS_PER_EURO);
}

export function creditsToEuroAtBaseRate(credits: number): number {
  return (credits * BASE_PACK_PRICE_EUR) / BASE_PACK_CREDITS;
}
