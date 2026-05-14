/**
 * Hourly-rotating "Speciaal voor jou" feed.
 *
 * Every wall-clock hour the home grid swaps to a fresh deterministic slice of
 * 10 profiles. Each user sees their own rotation: the picker hashes
 * `<userKey>:<slot>` so two visitors never see the same set in the same hour
 * (and a single visitor sees a different set next hour).
 *
 * Users can pay {@link HOURLY_FEED_REFRESH_COST} credits to skip ahead a slot
 * without waiting; the bump is persisted in `home_feed_state.refresh_offset`
 * server-side so it survives reloads and is consistent across devices.
 */

export const HOUR_MS = 60 * 60 * 1000;
export const HOURLY_FEED_SIZE = 10;
export const HOURLY_FEED_REFRESH_COST = 25;

/** Whole hours since epoch — increments at the top of every wall-clock hour. */
export function currentHourBucket(now: number = Date.now()): number {
  return Math.floor(now / HOUR_MS);
}

/** Epoch-ms timestamp of the next natural hour boundary (for the countdown). */
export function nextHourBoundary(now: number = Date.now()): number {
  return (currentHourBucket(now) + 1) * HOUR_MS;
}

/** Active slot id, factoring in any paid refreshes the user has accrued. */
export function activeFeedSlot(now: number, refreshOffset: number): number {
  return currentHourBucket(now) + Math.max(0, refreshOffset | 0);
}

/* ------------------------------------------------------------------------- */
/* Deterministic shuffle helpers                                              */
/* ------------------------------------------------------------------------- */

function fnv1aHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Pick a deterministic slice of `size` items from `pool`. Same `userKey + slot`
 * always returns the same slice in the same order, so SSR matches client.
 */
export function pickHourlyFeed<T>(
  pool: readonly T[],
  userKey: string,
  slot: number,
  size: number = HOURLY_FEED_SIZE,
): T[] {
  if (pool.length === 0) return [];
  const seed = fnv1aHash(`${userKey}::${slot}`);
  const rand = mulberry32(seed);
  const order = pool.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }
  return order.slice(0, Math.min(size, pool.length)).map((i) => pool[i]);
}
