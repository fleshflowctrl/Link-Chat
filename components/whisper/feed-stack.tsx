"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ChevronsRight,
  Coins,
  Heart,
  MessageCircle,
  RefreshCcw,
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

/**
 * Build a per-user, per-slot, per-composition localStorage key. The
 * composition hash makes the cursor reset cleanly when the visible set
 * changes (e.g. a profile got removed because the user opened a chat with
 * them) so we don't keep showing a stale "you're on profile #5" when
 * profile #5 is now a different person.
 */
function feedIndexKey(userKey: string, slot: number, feedHash: string): string {
  return `${FEED_INDEX_KEY_PREFIX}:${userKey}:${slot}:${feedHash}`;
}

function readSavedIndex(userKey: string, slot: number, feedHash: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(feedIndexKey(userKey, slot, feedHash));
    if (raw === null) return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** Persist the current index, and garbage-collect entries from older slots. */
function writeSavedIndex(
  userKey: string,
  slot: number,
  feedHash: string,
  index: number,
) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(feedIndexKey(userKey, slot, feedHash), String(index));
    const prefix = `${FEED_INDEX_KEY_PREFIX}:${userKey}:`;
    const stale: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(prefix)) continue;
      // key shape: `<prefix><slot>:<hash>`  — drop anything older than the current slot
      const rest = k.slice(prefix.length);
      const colon = rest.indexOf(":");
      const slotPart = colon === -1 ? rest : rest.slice(0, colon);
      const slotNum = parseInt(slotPart, 10);
      if (Number.isFinite(slotNum) && slotNum < slot) stale.push(k);
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

  // Restore the saved index for this user + slot + composition on mount, and
  // whenever any of those change. If we've already seen all profiles in this
  // pack, this keeps the user on the end-state instead of bouncing them back
  // to profile #1.
  useEffect(() => {
    setIndex(readSavedIndex(userKey, feedSlot, feedHash));
    setHydrated(true);
  }, [userKey, feedSlot, feedHash]);

  // Persist progress (skip the very first render before hydration to avoid
  // overwriting a saved value with the initial 0).
  useEffect(() => {
    if (!hydrated) return;
    writeSavedIndex(userKey, feedSlot, feedHash, index);
  }, [hydrated, userKey, feedSlot, feedHash, index]);

  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const total = profiles.length;
  const safeIndex = Math.min(index, total);
  const current: Profile | undefined = profiles[safeIndex];
  const atEnd = !current;

  // Fire a `seen` ping when the visible profile changes. Best-effort, so a
  // failed network call never blocks the UI; the server uses it to push this
  // profile to the back of the next pack and out of the rotation for a while.
  useEffect(() => {
    if (!hydrated || !current?.id) return;
    postProfileSeen(current.id);
  }, [hydrated, current?.id]);

  const remaining = Math.max(0, nextRefreshAt - now);
  const countdown = formatCountdown(remaining);

  const isAnonymous = balance === null;
  const insufficient = !isAnonymous && balance < refreshCost;
  const showProfileNudge = profile != null && !hasProfileBasics(profile);

  function handleNext() {
    setIndex((i) => Math.min(i + 1, total));
  }

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
            <FeedCard profile={current} />
          </div>

          <div className="grid shrink-0 grid-cols-2 gap-2.5">
            <Link
              href={`/messages/${current.id}`}
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
        <Heart
          className="h-5 w-5 text-primary"
          fill="currentColor"
          strokeWidth={0}
          aria-hidden
        />
      </span>
      <h2 className="text-[16px] font-extrabold tracking-tight text-ink">
        Je hebt alle {HOURLY_FEED_SIZE} gezien
      </h2>
      <p className="text-[12px] leading-snug text-inkMuted">
        Volgende selectie komt over{" "}
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
                : `Direct ${HOURLY_FEED_SIZE} nieuwe profielen`}
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
