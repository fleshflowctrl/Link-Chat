"use client";

import { useEffect, useState } from "react";
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
import { FeedCard } from "./feed-card";

type Props = {
  profiles: Profile[];
  /** Active hourly slot — used to reset the index when a fresh pack lands. */
  feedSlot: number;
  nextRefreshAt: number;
  refreshCost: number;
  /** Live credit balance (null = anonymous, hides paid refresh). */
  balance: number | null;
  onRefreshNow: () => void | Promise<void>;
  refreshing: boolean;
  refreshError: string | null;
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
  nextRefreshAt,
  refreshCost,
  balance,
  onRefreshNow,
  refreshing,
  refreshError,
}: Props) {
  const [index, setIndex] = useState(0);

  // Reset to the first card whenever a new pack arrives (paid refresh or hourly
  // rotation).
  useEffect(() => {
    setIndex(0);
  }, [feedSlot]);

  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const total = profiles.length;
  const safeIndex = Math.min(index, total);
  const current: Profile | undefined = profiles[safeIndex];
  const atEnd = !current;

  const remaining = Math.max(0, nextRefreshAt - now);
  const countdown = formatCountdown(remaining);

  const isAnonymous = balance === null;
  const insufficient = !isAnonymous && balance < refreshCost;

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
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <FeedEndCard
            countdown={countdown}
            refreshCost={refreshCost}
            balance={balance}
            isAnonymous={isAnonymous}
            insufficient={insufficient}
            refreshing={refreshing}
            onRefreshNow={onRefreshNow}
          />
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
    <div className="flex flex-col items-center gap-3 rounded-3xl bg-white p-6 text-center shadow-lg ring-1 ring-black/5">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-lavender">
        <Heart
          className="h-7 w-7 text-primary"
          fill="currentColor"
          strokeWidth={0}
          aria-hidden
        />
      </span>
      <h2 className="text-[18px] font-extrabold tracking-tight text-ink">
        Je hebt alle 10 gezien
      </h2>
      <p className="text-[13px] leading-snug text-inkMuted">
        Volgende selectie van 10 profielen komt over{" "}
        <span className="font-bold text-ink">{countdown}</span>.
      </p>

      {!isAnonymous && (
        <button
          type="button"
          onClick={() => {
            void onRefreshNow();
          }}
          disabled={refreshing || insufficient}
          className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-primary px-4 py-3 text-[14px] font-bold text-white shadow-md transition active:scale-[0.98] disabled:opacity-60"
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
                : "Direct 10 nieuwe profielen"}
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
