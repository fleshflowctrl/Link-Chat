/**
 * Timed-rotating "Speciaal voor jou" feed.
 *
 * Every {@link FEED_ROTATION_HOURS} hours the home grid swaps to a fresh
 * deterministic slice of 30 profiles. Each user sees their own rotation: the
 * picker hashes `<userKey>:<slot>` so two visitors never see the same set in
 * the same slot (and a single visitor sees a different set next rotation).
 *
 * Users can pay {@link HOURLY_FEED_REFRESH_COST} credits to skip ahead a slot
 * without waiting; the bump is persisted in `home_feed_state.refresh_offset`
 * server-side so it survives reloads and is consistent across devices.
 */

export const FEED_ROTATION_HOURS = 2;
export const HOUR_MS = FEED_ROTATION_HOURS * 60 * 60 * 1000;
export const HOURLY_FEED_SIZE = 30;
export {
  HOURLY_FEED_REFRESH_COST_CREDITS as HOURLY_FEED_REFRESH_COST,
  V2_HOURLY_FEED_REFRESH_COST_CREDITS,
} from "@/lib/credits/pricing";
import type { AppVariant } from "@/lib/app-variant";
import {
  HOURLY_FEED_REFRESH_COST_CREDITS,
  V2_HOURLY_FEED_REFRESH_COST_CREDITS,
} from "@/lib/credits/pricing";

/** Credit cost to skip the feed timer — 200 on v2, 260 on v1. */
export function hourlyFeedRefreshCostForVariant(variant: AppVariant): number {
  return variant === "v2"
    ? V2_HOURLY_FEED_REFRESH_COST_CREDITS
    : HOURLY_FEED_REFRESH_COST_CREDITS;
}

/** Whole rotation slots since epoch — increments every {@link FEED_ROTATION_HOURS}h. */
export function currentHourBucket(now: number = Date.now()): number {
  return Math.floor(now / HOUR_MS);
}

/** Epoch-ms timestamp of the next natural rotation boundary (for the countdown). */
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
  return shuffleDeterministic(pool, `${userKey}::${slot}`).slice(
    0,
    Math.min(size, pool.length),
  );
}

function shuffleDeterministic<T>(pool: readonly T[], seedKey: string): T[] {
  if (pool.length === 0) return [];
  const rand = mulberry32(fnv1aHash(seedKey));
  const order = pool.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }
  return order.map((i) => pool[i]);
}

/**
 * Variant of {@link pickHourlyFeed} that respects the user's discover history:
 *
 * - `excludeIds` are dropped from the pool entirely (e.g. profiles the user
 *   already opened a chat with).
 * - `demoteIds` are shuffled to the back of the resulting list (e.g. profiles
 *   the user has already swiped past recently) — so they only show up again
 *   after the "fresh" candidates have been exhausted.
 *
 * Determinism: same `<userKey, slot, history>` always returns the same slice
 * in the same order. Two independent shuffles are used (one for fresh, one
 * for demoted) so swapping a profile between buckets doesn't reshuffle the
 * other bucket.
 */
export function pickHourlyFeedWithHistory<T extends { id: string }>(
  pool: readonly T[],
  userKey: string,
  slot: number,
  opts: {
    excludeIds?: ReadonlySet<string>;
    demoteIds?: ReadonlySet<string>;
    size?: number;
  } = {},
): T[] {
  const size = opts.size ?? HOURLY_FEED_SIZE;
  if (pool.length === 0) return [];

  const exclude = opts.excludeIds ?? new Set<string>();
  const demote = opts.demoteIds ?? new Set<string>();

  const fresh: T[] = [];
  const demoted: T[] = [];
  for (const item of pool) {
    if (exclude.has(item.id)) continue;
    if (demote.has(item.id)) demoted.push(item);
    else fresh.push(item);
  }

  const shuffledFresh = shuffleDeterministic(
    fresh,
    `${userKey}::${slot}::fresh`,
  );
  const shuffledDemoted = shuffleDeterministic(
    demoted,
    `${userKey}::${slot}::demoted`,
  );

  return [...shuffledFresh, ...shuffledDemoted].slice(0, size);
}

/**
 * Compact stable hash of an ordered list of profile ids — used by the client
 * to key per-feed UI state (e.g. the current cursor) so the cursor resets
 * cleanly when the feed composition changes (chat opened, etc.).
 */
export function hashFeedComposition(ids: readonly string[]): string {
  return fnv1aHash(ids.join("|")).toString(36);
}
