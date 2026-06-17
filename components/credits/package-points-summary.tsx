"use client";

import {
  bundleBonusMessagesLabel,
  bundleMessagesLabel,
  bundleMessagesTotalLabel,
} from "@/lib/credits/copy";
import type { CreditPackage } from "@/data/credits";

export function PackageBonusBadge({ bonus }: { bonus: number }) {
  if (bonus <= 0) return null;
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-[#B52B2A]/15 px-2 py-0.5 text-[10px] font-bold leading-none text-[#B52B2A] ring-1 ring-[#B52B2A]/25">
      {bundleBonusMessagesLabel(bonus)}
    </span>
  );
}

export function PackagePointsSummary({
  pkg,
  compact = false,
  tone = "light",
}: {
  pkg: CreditPackage;
  compact?: boolean;
  tone?: "light" | "dark";
}) {
  const hasBonus = pkg.bonus > 0;
  const mutedClass =
    tone === "dark"
      ? compact
        ? "text-[11px] font-medium text-white/55"
        : "text-[12px] font-medium text-white/55"
      : compact
        ? "text-[11px] font-medium text-inkMuted"
        : "text-[12px] font-medium text-inkMuted";
  const totalClass =
    tone === "dark"
      ? compact
        ? "mt-0.5 text-[12px] font-extrabold text-white"
        : "mt-1 text-[13px] font-extrabold text-white"
      : compact
        ? "mt-0.5 text-[12px] font-extrabold text-ink"
        : "mt-1 text-[13px] font-extrabold text-ink";

  if (!hasBonus) {
    return (
      <p className={compact ? "mt-0.5 text-[12px] font-medium text-inkMuted" : mutedClass}>
        {bundleMessagesLabel(pkg.credits)}
      </p>
    );
  }

  return (
    <div className={compact ? "mt-0.5 space-y-0.5" : "mt-1 space-y-1"}>
      <p className={mutedClass}>{bundleMessagesLabel(pkg.credits)}</p>
      <p className={totalClass}>
        Totaal: {bundleMessagesTotalLabel(pkg.credits, pkg.bonus)}
      </p>
    </div>
  );
}
