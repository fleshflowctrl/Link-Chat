"use client";

import { useEffect, useState } from "react";
import { Coins, Heart, RefreshCcw, Timer } from "lucide-react";

type Props = {
  /** Epoch-ms timestamp of the next natural hourly rotation. */
  nextRefreshAt: number;
  /** Credit cost to skip ahead to a fresh slot now. */
  refreshCost: number;
  /** Live credit balance (null = anonymous, button hidden). */
  balance: number | null;
  /** Triggered when the user taps the pay-to-refresh button. */
  onRefreshNow: () => void;
  /** Disables the button while a request is in-flight. */
  refreshing: boolean;
  /** Last error from a failed paid refresh, if any. */
  error: string | null;
};

/** "12m 34s" countdown text. Returns "Nu" when <=0. */
function formatCountdown(ms: number): string {
  if (ms <= 0) return "Nu";
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return `${h}u ${mm}m`;
  }
  if (m >= 10) return `${m}m`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

/**
 * Combined header for the rotating "Speciaal voor jou" grid:
 * - Title + subtitle that explains the hourly drop.
 * - Live countdown pill until the next free rotation.
 * - Optional pay-to-refresh-now button (signed-in users only).
 */
export function HomeFeedHeader({
  nextRefreshAt,
  refreshCost,
  balance,
  onRefreshNow,
  refreshing,
  error,
}: Props) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.max(0, nextRefreshAt - now);
  const countdown = formatCountdown(remaining);

  const isAnonymous = balance === null;
  const insufficient = !isAnonymous && balance < refreshCost;

  return (
    <section className="px-4 pt-4" aria-labelledby="home-for-you-heading">
      <div className="flex items-start gap-2.5">
        <Heart
          className="mt-0.5 h-5 w-5 shrink-0 text-primary"
          fill="currentColor"
          strokeWidth={0}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2
              id="home-for-you-heading"
              className="text-[17px] font-bold leading-tight tracking-tight text-ink"
            >
              Speciaal voor jou
            </h2>
            <span
              className="flex shrink-0 items-center gap-1 rounded-full bg-lavender px-2 py-0.5 text-[11px] font-bold tabular-nums text-primary"
              aria-live="polite"
            >
              <Timer className="h-3 w-3" strokeWidth={2.25} aria-hidden />
              <span>{countdown}</span>
            </span>
          </div>
          <p className="mt-0.5 text-[13px] leading-snug text-inkMuted">
            Elk uur 10 nieuwe profielen voor jou
          </p>
        </div>
      </div>

      {!isAnonymous && (
        <div className="mt-3">
          <button
            type="button"
            onClick={onRefreshNow}
            disabled={refreshing || insufficient}
            className="flex w-full min-w-0 items-center justify-center gap-2 rounded-2xl bg-gradient-primary px-4 py-2.5 text-[13px] font-bold leading-tight text-white shadow-md transition active:scale-[0.98] disabled:opacity-60"
          >
            <RefreshCcw
              className={`h-4 w-4 shrink-0 ${refreshing ? "animate-spin" : ""}`}
              strokeWidth={2.5}
              aria-hidden
            />
            <span className="min-w-0 truncate">
              {refreshing
                ? "Vernieuwen…"
                : insufficient
                  ? `Te weinig credits (${refreshCost} nodig)`
                  : "Vernieuw nu"}
            </span>
            {!refreshing && !insufficient && (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-bold">
                <Coins className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                {refreshCost}
              </span>
            )}
          </button>
          {error && (
            <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">
              {error}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
