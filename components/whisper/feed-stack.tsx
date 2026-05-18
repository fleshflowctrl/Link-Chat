"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import {
  ChevronsRight,
  Coins,
  MessageCircle,
  RefreshCcw,
  Sparkles,
  Timer,
} from "lucide-react";
import type { Profile } from "@/data/profiles";
import { HOURLY_FEED_SIZE } from "@/lib/catalog/hourly-feed";
import type { EditProfileState } from "@/data/me-edit";
import { hasProfileBasics } from "@/lib/me/profile-completeness";
import {
  getCreditsSnapshot,
  subscribeCredits,
} from "@/lib/credits-store";
import { FeedCard } from "./feed-card";
import { ProfileStrengthBanner } from "./profile-strength-banner";

const FEED_INDEX_KEY_PREFIX = "whisper_feed_index";

type SavedCursor = { index: number; profileId: string | null };

/**
 * Per-user, per-slot localStorage key. Keeping this purely slot-keyed (not
 * composition-keyed) is intentional: the server caches the pack ordering
 * inside the slot, so the cursor stays meaningful even if a profile gets
 * removed (chat opened). When the slot rotates the key changes and the
 * cursor naturally resets to 0.
 */
function feedIndexKey(userKey: string, slot: number): string {
  return `${FEED_INDEX_KEY_PREFIX}:${userKey}:${slot}`;
}

function readSavedCursor(userKey: string, slot: number): SavedCursor {
  if (typeof window === "undefined") return { index: 0, profileId: null };
  try {
    const raw = localStorage.getItem(feedIndexKey(userKey, slot));
    if (raw === null) return { index: 0, profileId: null };
    // New format is JSON `{index, profileId}`. Older entries are just
    // a stringified integer — keep reading them for one slot rotation.
    if (raw.startsWith("{")) {
      const parsed = JSON.parse(raw) as Partial<SavedCursor>;
      const index =
        typeof parsed.index === "number" && parsed.index >= 0
          ? Math.floor(parsed.index)
          : 0;
      const profileId =
        typeof parsed.profileId === "string" && parsed.profileId
          ? parsed.profileId
          : null;
      return { index, profileId };
    }
    const n = parseInt(raw, 10);
    return {
      index: Number.isFinite(n) && n >= 0 ? n : 0,
      profileId: null,
    };
  } catch {
    return { index: 0, profileId: null };
  }
}

/** Persist the cursor, and garbage-collect entries from older slots. */
function writeSavedCursor(
  userKey: string,
  slot: number,
  cursor: SavedCursor,
) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      feedIndexKey(userKey, slot),
      JSON.stringify(cursor),
    );
    const prefix = `${FEED_INDEX_KEY_PREFIX}:${userKey}:`;
    const stale: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(prefix)) continue;
      // key shape: `<prefix><slot>` or legacy `<prefix><slot>:<hash>`.
      const rest = k.slice(prefix.length);
      const colon = rest.indexOf(":");
      const slotPart = colon === -1 ? rest : rest.slice(0, colon);
      const slotNum = parseInt(slotPart, 10);
      if (Number.isFinite(slotNum) && slotNum < slot) stale.push(k);
      // Drop any legacy composition-keyed entry for the current slot too.
      else if (colon !== -1 && slotNum === slot) stale.push(k);
    }
    for (const k of stale) localStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}

/** Best-effort fire-and-forget — record that the user saw this profile. */
function postProfileSeen(profileId: string) {
  if (typeof window === "undefined" || !profileId) return;
  try {
    void fetch("/api/me/feed/seen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId }),
      credentials: "same-origin",
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

/** Number of upcoming profile photos to preload while the user is browsing. */
const PRELOAD_AHEAD = 3;

/**
 * Warm the browser image cache for the next `count` profiles so rapid
 * "Volgende" taps swap to a fully-decoded image without a flash of blank.
 */
function usePreloadNextPhotos(
  profiles: Profile[],
  index: number,
  count: number,
) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const refs: HTMLImageElement[] = [];
    for (let i = 1; i <= count; i++) {
      const next = profiles[index + i];
      if (!next?.photo) continue;
      const img = new window.Image();
      img.decoding = "async";
      img.loading = "eager";
      img.src = next.photo;
      refs.push(img);
    }
    return () => {
      for (const img of refs) img.src = "";
    };
  }, [profiles, index, count]);
}

type Props = {
  profiles: Profile[];
  /** Active hourly slot — used to reset the index when a fresh pack lands. */
  feedSlot: number;
  /** Stable hash of the current ordered profile ids — when this changes
   *  (e.g. user opened a chat with one of them) the cursor resets cleanly. */
  feedHash: string;
  nextRefreshAt: number;
  refreshCost: number;
  /** Live credit balance (null = anonymous, hides paid refresh). */
  balance: number | null;
  onRefreshNow: () => void | Promise<void>;
  refreshing: boolean;
  refreshError: string | null;
  /** Signed-in user profile — used to render the compact "profiel afmaken"
   *  nudge under the end-state. `null` for guests. */
  profile?: EditProfileState | null;
};

function formatCountdown(ms: number): string {
  if (ms <= 0) return "Nu";
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    return `${h}u ${m % 60}m`;
  }
  if (m >= 10) return `${m}m`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

/**
 * Discover feed shown one profile at a time. The user advances by tapping
 * "Volgende"; tapping "Open gesprek" jumps straight into chat. After the last
 * card a small end-state nudges the user to wait for the next hourly drop or
 * pay {@link refreshCost} credits to skip ahead immediately.
 */
export function FeedStack({
  profiles,
  feedSlot,
  feedHash,
  nextRefreshAt,
  refreshCost,
  balance,
  onRefreshNow,
  refreshing,
  refreshError,
  profile,
}: Props) {
  // Per-user key so two accounts in the same browser don't share progress.
  const userKey = useSyncExternalStore(
    subscribeCredits,
    getCreditsSnapshot,
    getCreditsSnapshot,
  ).userKey;

  const [index, setIndex] = useState<number>(0);
  const [hydrated, setHydrated] = useState(false);

  // Restore the cursor for this user + slot. If the saved profileId still
  // exists in the current pack we resume on exactly that profile, even when
  // earlier profiles were removed mid-slot (e.g. user opened a chat with
  // one). Otherwise fall back to the saved integer position clamped to the
  // current pack size. A new slot uses a fresh storage key so this is a
  // natural reset when the timer rotates.
  useEffect(() => {
    const saved = readSavedCursor(userKey, feedSlot);
    let resumeIndex = Math.min(Math.max(0, saved.index), profiles.length);
    if (saved.profileId) {
      const found = profiles.findIndex((p) => p.id === saved.profileId);
      if (found >= 0) resumeIndex = found;
    }
    setIndex(resumeIndex);
    setHydrated(true);
    // We intentionally re-derive on slot change; pack changes inside a slot
    // shouldn't reset (the server keeps order stable), so `profiles` and
    // `feedHash` are not deps here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userKey, feedSlot]);

  // Persist progress (skip the very first render before hydration to avoid
  // overwriting a saved value with the initial 0).
  useEffect(() => {
    if (!hydrated) return;
    const profileId = profiles[index]?.id ?? null;
    writeSavedCursor(userKey, feedSlot, { index, profileId });
  }, [hydrated, userKey, feedSlot, index, profiles]);

  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const total = profiles.length;
  const safeIndex = Math.min(index, total);
  const current: Profile | undefined = profiles[safeIndex];
  const atEnd = !current;

  // Fire a `seen` ping when the visible profile changes. Debounced so rapid
  // "Volgende" taps don't flood /api/me/feed/seen — we only record the profile
  // the user actually lingered on (~350 ms). Best-effort either way.
  const seenSentRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!hydrated || !current?.id) return;
    const id = current.id;
    if (seenSentRef.current.has(id)) return;
    const t = window.setTimeout(() => {
      seenSentRef.current.add(id);
      postProfileSeen(id);
    }, 350);
    return () => window.clearTimeout(t);
  }, [hydrated, current?.id]);

  // Pre-warm the next few photos so the image is already decoded by the
  // time the user taps "Volgende" — eliminates the lag where the new card
  // briefly shows the gray bg or stale photo while the next file loads.
  usePreloadNextPhotos(profiles, safeIndex, PRELOAD_AHEAD);

  const remaining = Math.max(0, nextRefreshAt - now);
  const countdown = formatCountdown(remaining);

  const isAnonymous = balance === null;
  const insufficient = !isAnonymous && balance < refreshCost;
  const showProfileNudge = profile != null && !hasProfileBasics(profile);

  // Always advance from the *latest* index using a functional update so
  // rapid taps queue up correctly in React 18's automatic batching.
  const handleNext = useCallback(() => {
    setIndex((i) => Math.min(i + 1, total));
  }, [total]);

  // Stable href for "Open gesprek" so React doesn't churn the link on every
  // tap. (Not strictly needed but keeps the render hot-path tiny.)
  const openHref = useMemo(
    () => (current ? `/messages/${current.id}` : "#"),
    [current],
  );

  return (
    <section className="flex min-h-0 w-full flex-1 flex-col gap-2 px-4 pb-3 pt-2">
      {/* Progress dots + countdown */}
      <div className="flex items-center gap-2.5">
        <div className="flex flex-1 items-center gap-1">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i < safeIndex
                  ? "bg-primary/60"
                  : i === safeIndex
                    ? "bg-primary"
                    : "bg-gray-200"
              }`}
            />
          ))}
        </div>
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-lavender px-2 py-0.5 text-[11px] font-bold tabular-nums text-primary">
          <Timer className="h-3 w-3" strokeWidth={2.25} aria-hidden />
          <span>{countdown}</span>
        </span>
      </div>

      {atEnd ? (
        <div className="flex min-h-0 flex-1 flex-col items-stretch justify-center gap-2 overflow-hidden">
          <FeedEndCard
            countdown={countdown}
            refreshCost={refreshCost}
            balance={balance}
            isAnonymous={isAnonymous}
            insufficient={insufficient}
            refreshing={refreshing}
            onRefreshNow={onRefreshNow}
          />
          {showProfileNudge && profile && (
            <ProfileStrengthBanner profile={profile} compact />
          )}
        </div>
      ) : (
        <>
          <div className="flex min-h-0 flex-1">
            <FeedCard key={current.id} profile={current} />
          </div>

          <div className="grid shrink-0 grid-cols-2 gap-2.5">
            <Link
              href={openHref}
              className="flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-primary px-3 py-2.5 text-white shadow-md transition active:scale-[0.98]"
            >
              <MessageCircle
                className="h-5 w-5 shrink-0"
                strokeWidth={2.5}
                aria-hidden
              />
              <span className="flex min-w-0 flex-col text-left leading-tight">
                <span className="text-[14px] font-bold">Open gesprek</span>
                <span className="truncate text-[11px] font-medium opacity-90">
                  Praat met {current.name}
                </span>
              </span>
            </Link>

            <button
              type="button"
              onClick={handleNext}
              className="flex items-center justify-center gap-2.5 rounded-2xl bg-gray-900 px-3 py-2.5 text-white shadow-md transition active:scale-[0.98]"
            >
              <ChevronsRight
                className="h-5 w-5 shrink-0"
                strokeWidth={2.5}
                aria-hidden
              />
              <span className="flex flex-col text-left leading-tight">
                <span className="text-[14px] font-bold">Volgende</span>
                <span className="text-[11px] font-medium opacity-70">
                  Iemand anders
                </span>
              </span>
            </button>
          </div>
        </>
      )}

      {refreshError && (
        <p className="shrink-0 rounded-xl bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">
          {refreshError}
        </p>
      )}
    </section>
  );
}

type EndProps = {
  countdown: string;
  refreshCost: number;
  balance: number | null;
  isAnonymous: boolean;
  insufficient: boolean;
  refreshing: boolean;
  onRefreshNow: () => void | Promise<void>;
};

function FeedEndCard({
  countdown,
  refreshCost,
  isAnonymous,
  insufficient,
  refreshing,
  onRefreshNow,
}: EndProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl bg-white p-4 text-center shadow-lg ring-1 ring-black/5">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-lavender">
        <Sparkles
          className="h-5 w-5 text-primary"
          strokeWidth={2.25}
          aria-hidden
        />
      </span>
      <h2 className="text-[16px] font-extrabold tracking-tight text-ink">
        Klaar met deze ronde
      </h2>
      <p className="text-[12px] leading-snug text-inkMuted">
        Dit waren je {HOURLY_FEED_SIZE} matches van dit uur — er staan{" "}
        <span className="font-bold text-ink">honderden andere profielen</span>{" "}
        klaar. Nieuwe selectie over{" "}
        <span className="font-bold text-ink">{countdown}</span>.
      </p>

      {!isAnonymous && (
        <button
          type="button"
          onClick={() => {
            void onRefreshNow();
          }}
          disabled={refreshing || insufficient}
          className="mt-0.5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary px-3 py-2.5 text-[13px] font-bold text-white shadow-md transition active:scale-[0.98] disabled:opacity-60"
        >
          <RefreshCcw
            className={`h-4 w-4 shrink-0 ${refreshing ? "animate-spin" : ""}`}
            strokeWidth={2.5}
            aria-hidden
          />
          <span className="truncate">
            {refreshing
              ? "Vernieuwen…"
              : insufficient
                ? `Te weinig credits (${refreshCost} nodig)`
                : `Toon nu ${HOURLY_FEED_SIZE} nieuwe profielen`}
          </span>
          {!refreshing && !insufficient && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold">
              <Coins className="h-3 w-3" strokeWidth={2.5} aria-hidden />
              {refreshCost}
            </span>
          )}
        </button>
      )}

    </div>
  );
}
