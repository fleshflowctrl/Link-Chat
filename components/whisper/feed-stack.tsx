"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronsRight,
  Coins,
  MessageCircle,
  RefreshCcw,
  Sparkles,
  Timer,
  Zap,
} from "lucide-react";
import type { Profile } from "@/data/profiles";
import { HOURLY_FEED_SIZE } from "@/lib/catalog/hourly-feed";
import type { EditProfileState } from "@/data/me-edit";
import { hasProfileBasics } from "@/lib/me/profile-completeness";
import { BUNDLES_TITLE, bundleUnits, BUY_BUNDLES_CTA, insufficientBundleWithCost } from "@/lib/credits/copy";
import {
  getCreditsSnapshot,
  subscribeCredits,
} from "@/lib/credits-store";
import { useAppVariant } from "@/components/app-variant-provider";
import { withVariantPath } from "@/lib/app-variant";
import { GuestMessageAuthPrompt } from "@/components/auth/guest-message-auth-prompt";
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

import { postProfileSeen } from "@/lib/catalog/post-profile-seen";

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
  /** Tighter spacing so discover fits one mobile viewport (v2). */
  compact?: boolean;
  /** One-shot: open on this profile (e.g. funnel pick) instead of saved cursor. */
  startAtProfileId?: string | null;
  /** Guest photo blur for specific profile ids. */
  lockedPhotoIds?: Set<string>;
  /** Guests must sign up before opening chat. */
  requiresAuthForMessage?: boolean;
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
  compact = false,
  startAtProfileId = null,
  lockedPhotoIds = new Set<string>(),
  requiresAuthForMessage = false,
}: Props) {
  const { variant } = useAppVariant();
  const isV2 = variant === "v2";

  // Per-user key so two accounts in the same browser don't share progress.
  const userKey = useSyncExternalStore(
    subscribeCredits,
    getCreditsSnapshot,
    getCreditsSnapshot,
  ).userKey;

  const [index, setIndex] = useState<number>(0);
  const [hydrated, setHydrated] = useState(false);
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  /** Only animate card transitions after the user taps Volgende or swipes. */
  const slideTransitionsRef = useRef(false);

  // Restore the cursor for this user + slot. If the saved profileId still
  // exists in the current pack we resume on exactly that profile, even when
  // earlier profiles were removed mid-slot (e.g. user opened a chat with
  // one). Otherwise fall back to the saved integer position clamped to the
  // current pack size. A new slot uses a fresh storage key so this is a
  // natural reset when the timer rotates.
  useLayoutEffect(() => {
    if (startAtProfileId) {
      const found = profiles.findIndex((p) => p.id === startAtProfileId);
      setIndex(found >= 0 ? found : 0);
      setHydrated(true);
      return;
    }
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
  }, [userKey, feedSlot, startAtProfileId]);

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

  useEffect(() => {
    setAuthPromptOpen(false);
  }, [current?.id]);

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
    slideTransitionsRef.current = true;
    setIndex((i) => Math.min(i + 1, total));
  }, [total]);

  // Stable href for "Open gesprek" so React doesn't churn the link on every
  // tap. (Not strictly needed but keeps the render hot-path tiny.)
  const openHref = useMemo(
    () => (current ? withVariantPath(`/messages/${current.id}`, variant) : "#"),
    [current, variant],
  );

  const progressPct =
    total > 0 ? Math.min(100, ((safeIndex + 1) / total) * 100) : 0;

  const primaryBtnClass = compact
    ? "flex min-h-[52px] items-center justify-center gap-2.5 rounded-full px-4 py-3.5 text-white shadow-md transition active:scale-[0.98]"
    : "flex min-h-[56px] items-center justify-center gap-2.5 rounded-full px-4 py-3.5 text-white shadow-md transition active:scale-[0.98]";

  const primaryBtnStyle = isV2
    ? "bg-gradient-to-r from-[#AD3635] to-[#C4403F] ring-1 ring-black/10"
    : "bg-gradient-primary";

  const secondaryBtnStyle = isV2
    ? "bg-gradient-to-r from-[#962B2A] to-[#A83635] ring-1 ring-black/15"
    : "bg-gray-900";

  const swipeDismiss = useCallback(
    (offsetX: number, velocityX: number) => {
      const threshold = 72;
      if (offsetX < -threshold || velocityX < -450) {
        handleNext();
      }
    },
    [handleNext],
  );

  return (
    <section
      className={
        compact
          ? "flex min-h-0 w-full flex-1 flex-col gap-1 px-3 pb-2 pt-0.5"
          : "flex min-h-0 w-full flex-1 flex-col gap-2 px-4 pb-3 pt-2"
      }
    >
      {/* Progress bar */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-gray-200/80">
        <div
          className={`h-full rounded-full transition-[width] duration-300 ease-out ${
            isV2 ? "bg-[#B52B2A]" : "bg-primary"
          }`}
          style={{ width: `${progressPct}%` }}
          role="progressbar"
          aria-valuenow={safeIndex + 1}
          aria-valuemin={1}
          aria-valuemax={total}
          aria-label={`Profiel ${safeIndex + 1} van ${total}`}
        />
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
          <div className="relative flex min-h-0 flex-1 overflow-hidden">
            {!hydrated ? null : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={current.id}
                className="flex h-full w-full touch-pan-y"
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.65}
                onDragEnd={(_, info) =>
                  swipeDismiss(info.offset.x, info.velocity.x)
                }
                initial={
                  slideTransitionsRef.current
                    ? { opacity: 0, x: 48, scale: 0.98 }
                    : false
                }
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={
                  slideTransitionsRef.current
                    ? { opacity: 0, x: -100, scale: 0.96 }
                    : { opacity: 1, x: 0, scale: 1 }
                }
                transition={{ type: "spring", stiffness: 400, damping: 34 }}
              >
                <FeedCard
                  profile={current}
                  compact={compact}
                  photoLocked={lockedPhotoIds.has(current.id)}
                />
              </motion.div>
            </AnimatePresence>
            )}
          </div>

          <div
            className={
              compact
                ? "grid shrink-0 grid-cols-2 gap-2.5"
                : "grid shrink-0 grid-cols-2 gap-3"
            }
          >
            {requiresAuthForMessage ? (
              <button
                type="button"
                onClick={() => {
                  postProfileSeen(current.id);
                  setAuthPromptOpen(true);
                }}
                className={`${primaryBtnClass} ${primaryBtnStyle}`}
              >
                <MessageCircle
                  className={compact ? "h-5 w-5 shrink-0" : "h-5 w-5 shrink-0"}
                  strokeWidth={2.5}
                  aria-hidden
                />
                <span className="flex min-w-0 flex-col text-left leading-tight">
                  <span
                    className={
                      compact ? "text-[15px] font-bold" : "text-[15px] font-bold"
                    }
                  >
                    Open gesprek
                  </span>
                  {!compact && (
                    <span className="truncate text-[11px] font-medium opacity-90">
                      Praat met {current.name}
                    </span>
                  )}
                </span>
              </button>
            ) : (
              <Link
                href={openHref}
                className={`${primaryBtnClass} ${primaryBtnStyle}`}
                onClick={() => postProfileSeen(current.id)}
              >
                <MessageCircle
                  className={compact ? "h-5 w-5 shrink-0" : "h-5 w-5 shrink-0"}
                  strokeWidth={2.5}
                  aria-hidden
                />
                <span className="flex min-w-0 flex-col text-left leading-tight">
                  <span
                    className={
                      compact ? "text-[15px] font-bold" : "text-[15px] font-bold"
                    }
                  >
                    Open gesprek
                  </span>
                  {!compact && (
                    <span className="truncate text-[11px] font-medium opacity-90">
                      Praat met {current.name}
                    </span>
                  )}
                </span>
              </Link>
            )}

            <button
              type="button"
              onClick={handleNext}
              className={`${primaryBtnClass} ${secondaryBtnStyle}`}
            >
              <ChevronsRight
                className={compact ? "h-5 w-5 shrink-0" : "h-5 w-5 shrink-0"}
                strokeWidth={2.5}
                aria-hidden
              />
              <span className="flex flex-col text-left leading-tight">
                <span
                  className={
                    compact ? "text-[15px] font-bold" : "text-[15px] font-bold"
                  }
                >
                  Volgende
                </span>
                {!compact && (
                  <span className="text-[11px] font-medium opacity-70">
                    Iemand anders
                  </span>
                )}
              </span>
            </button>
          </div>

          {current && (
            <GuestMessageAuthPrompt
              open={authPromptOpen}
              onClose={() => setAuthPromptOpen(false)}
              returnPath={openHref}
              profileName={current.name}
            />
          )}
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
  const { variant } = useAppVariant();
  const isV2 = variant === "v2";

  return (
    <div
      className={
        isV2
          ? "relative flex flex-col items-center gap-3 overflow-hidden rounded-3xl border border-white/10 bg-[#2A2A2B] p-5 text-center shadow-xl ring-1 ring-[#B52B2A]/25"
          : "relative flex flex-col items-center gap-3 overflow-hidden rounded-3xl bg-white p-5 text-center shadow-xl ring-1 ring-black/5"
      }
    >
      {!isV2 && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br from-primary/25 via-accentPink/15 to-transparent blur-2xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -left-16 bottom-0 h-40 w-40 rounded-full bg-gradient-to-tr from-accentPink/20 via-primary/10 to-transparent blur-2xl"
          />
        </>
      )}

      <span
        className={
          isV2
            ? "relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#B52B2A] to-[#D63B3A] shadow-md ring-4 ring-[#B52B2A]/30"
            : "relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accentPink shadow-md ring-4 ring-lavender/60"
        }
      >
        <Sparkles
          className="h-7 w-7 text-white"
          strokeWidth={2.25}
          aria-hidden
        />
      </span>

      <div className="relative flex flex-col items-center gap-1">
        <h2 className="text-[20px] font-extrabold tracking-tight text-ink">
          Klaar voor meer?
        </h2>
        <p className="text-[13px] leading-snug text-inkMuted">
          Je hebt de {HOURLY_FEED_SIZE} matches van dit uur bekeken — maar{" "}
          <span className="font-bold text-ink">
            honderden andere profielen
          </span>{" "}
          wachten al.
        </p>
      </div>

      {!isAnonymous && (
        <div className="relative w-full">
          <button
            type="button"
            onClick={() => {
              void onRefreshNow();
            }}
            disabled={refreshing || insufficient}
            className={
              isV2
                ? "group relative flex w-full flex-col items-center gap-1 overflow-hidden rounded-2xl bg-gradient-to-r from-[#B52B2A] via-[#C93535] to-[#D63B3A] px-4 py-3 text-white shadow-lg transition active:scale-[0.98] disabled:opacity-60"
                : "group relative flex w-full flex-col items-center gap-1 overflow-hidden rounded-2xl bg-gradient-to-r from-primary via-[#8B6BFF] to-accentPink px-4 py-3 text-white shadow-lg transition active:scale-[0.98] disabled:opacity-60"
            }
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full group-active:translate-x-full"
            />
            <span className="relative flex items-center gap-2 text-[15px] font-extrabold">
              {refreshing ? (
                <RefreshCcw
                  className="h-4 w-4 animate-spin"
                  strokeWidth={2.5}
                  aria-hidden
                />
              ) : (
                <Zap
                  className="h-4 w-4"
                  fill="currentColor"
                  strokeWidth={0}
                  aria-hidden
                />
              )}
              {refreshing
                ? "Vernieuwen…"
                : insufficient
                  ? insufficientBundleWithCost(refreshCost)
                  : `Ontgrendel ${HOURLY_FEED_SIZE} nieuwe matches`}
            </span>
            {!refreshing && !insufficient && (
              <span className="relative flex items-center gap-1.5 text-[11px] font-semibold text-white/90">
                <span>Geen ruzie met de wachttijd —</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold tabular-nums backdrop-blur-sm">
                  <Coins className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                  {refreshCost}
                </span>
              </span>
            )}
          </button>

          <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] font-medium text-inkMuted">
            <Timer className="h-3 w-3" strokeWidth={2.5} aria-hidden />
            <span>
              Of wacht{" "}
              <span className="font-bold text-ink">{countdown}</span> op de
              volgende ronde
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
