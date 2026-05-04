"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Clock } from "lucide-react";
import { StatusBarMock } from "@/components/messages/status-bar-mock";
import {
  offerCountdownInitialSeconds,
  packages,
  type CreditPackage,
} from "@/data/credits";
import { meProfile } from "@/data/me";

function formatMoney(n: number): string {
  return `$${n.toFixed(2)}`;
}

function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}

function PackageCard({
  pkg,
  selected,
  onSelect,
}: {
  pkg: CreditPackage;
  selected: boolean;
  onSelect: () => void;
}) {
  const reserveTopRibbon =
    pkg.badge === "most-popular" ||
    pkg.badge === "trending" ||
    pkg.badge === "best-value";

  return (
    <div className="relative pt-1">
      {pkg.badge === "most-popular" && (
        <span className="absolute -top-2.5 left-3 z-10 rounded-md bg-[#7C5CFF] px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white shadow-sm">
          Most popular
        </span>
      )}
      {pkg.saveBadge && pkg.badge === "most-popular" && (
        <span className="absolute -top-2.5 right-3 z-10 rounded-md bg-green-500 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white shadow-sm">
          Save 20%
        </span>
      )}
      {pkg.badge === "trending" && (
        <span className="absolute -top-2.5 right-3 z-10 rounded-md bg-amber-400 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white shadow-sm">
          🔥 Trending
        </span>
      )}
      {pkg.badge === "best-value" && (
        <span className="absolute -top-2.5 right-3 z-10 rounded-md bg-emerald-500 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white shadow-sm">
          Best value
        </span>
      )}

      <button
        type="button"
        onClick={onSelect}
        className={`relative flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-black/[0.05] transition active:scale-[0.99] ${
          selected
            ? "ring-2 ring-[#7C5CFF] shadow-lg ring-offset-2 ring-offset-[#F5F3EE]"
            : ""
        } ${reserveTopRibbon ? "mt-2" : ""}`}
      >
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-lg shadow-inner ${pkg.tile}`}
        >
          <span aria-hidden>{pkg.icon}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-base font-bold text-ink">
              {pkg.credits} credits
            </span>
            <span className="rounded-full bg-pink-100 px-2 py-0.5 text-[10px] font-bold text-pink-600">
              +{pkg.bonus} bonus
            </span>
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-gray-500">
            ≈ {formatMoney(pkg.perCredit)} / credit · Save 20%
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2 pr-0.5">
          <div className="text-right">
            <p className="text-[18px] font-bold leading-none text-ink">
              {formatMoney(pkg.price)}
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-gray-400 line-through">
              {formatMoney(pkg.original)}
            </p>
          </div>
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
              selected
                ? "border-[#7C5CFF] bg-[#7C5CFF]"
                : "border-gray-300 bg-transparent"
            }`}
            aria-hidden
          >
            {selected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
          </span>
        </div>
      </button>
    </div>
  );
}

export function CreditsView() {
  const balance = meProfile.stats.credits.value;
  const defaultId =
    packages.find((p) => p.defaultSelected)?.id ?? packages[0].id;
  const [selectedId, setSelectedId] = useState(defaultId);
  const [secondsLeft, setSecondsLeft] = useState(offerCountdownInitialSeconds);

  const selected = useMemo(
    () => packages.find((p) => p.id === selectedId) ?? packages[0],
    [selectedId],
  );

  const tick = useCallback(() => {
    setSecondsLeft((prev) => {
      if (prev <= 1) return offerCountdownInitialSeconds;
      return prev - 1;
    });
  }, []);

  useEffect(() => {
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [tick]);

  const countdownLabel = useMemo(
    () => formatCountdown(secondsLeft),
    [secondsLeft],
  );

  return (
    <div className="bg-[#F5F3EE] pb-8">
      <StatusBarMock />

      <header className="flex items-start justify-between gap-3 px-5 pb-3 pt-1">
        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-ink">
            Credits
          </h1>
          <p className="mt-1 text-[12px] text-gray-500">
            Send messages &amp; link with people
          </p>
        </div>

        <div className="shrink-0 rounded-2xl bg-gradient-to-br from-[#7C5CFF] to-[#9B7BFF] px-3 py-2 text-center text-white shadow-sm">
          <p className="text-[9px] font-bold uppercase tracking-wider text-white/80">
            Balance
          </p>
          <div className="mt-1 flex items-center justify-center gap-1.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 text-[10px] font-bold text-white">
              $
            </span>
            <span className="text-lg font-bold tabular-nums leading-none">
              {balance}
            </span>
          </div>
        </div>
      </header>

      <div className="px-5 pb-5">
        <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-pink-100 via-purple-100 to-indigo-100 p-4 shadow-md">
          <span className="text-3xl" aria-hidden>
            🎁
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold leading-tight text-ink">
              First-time bonus
            </p>
            <p className="mt-0.5 text-[12px] font-medium leading-snug text-gray-600">
              +20% extra on any pack
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-2 shadow-sm">
            <Clock className="h-4 w-4 shrink-0 text-[#7C5CFF]" strokeWidth={2.25} />
            <span className="font-mono text-[13px] font-bold tabular-nums tracking-tight text-[#7C5CFF]">
              {countdownLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-2.5 px-5 pb-4">
        {packages.map((pkg) => (
          <PackageCard
            key={pkg.id}
            pkg={pkg}
            selected={selectedId === pkg.id}
            onSelect={() => setSelectedId(pkg.id)}
          />
        ))}
      </div>

      <div className="flex flex-col gap-2 px-5 pt-2">
        <button
          type="button"
          onClick={() =>
            console.log("[credits] Apple Pay", selected.id, selected.price)
          }
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-black px-5 py-3.5 text-[15px] font-bold text-white shadow-lg transition active:scale-[0.99]"
        >
          <svg
            className="h-6 w-6 shrink-0"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
          >
            <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
          </svg>
          <span>Pay · {formatMoney(selected.price)}</span>
        </button>
        <button
          type="button"
          onClick={() =>
            console.log("[credits] Card", selected.id, selected.price)
          }
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-3 text-[15px] font-semibold text-ink shadow-sm transition active:scale-[0.99]"
        >
          <span aria-hidden>💳</span>
          <span>Pay with card</span>
        </button>
      </div>
    </div>
  );
}
