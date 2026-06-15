"use client";

import { VariantLink as Link } from "@/components/variant-link";
import { useAppVariant } from "@/components/app-variant-provider";
import { useEffect, useSyncExternalStore } from "react";
import {
  getCreditsSnapshot,
  initCreditsStore,
  isPermanentCreditsUser,
  subscribeCredits,
} from "@/lib/credits-store";

/**
 * Consistent credits-balance pill used in every page header.
 * Reads live from credits-store — no props needed.
 */
export function CreditsPill() {
  const { variant } = useAppVariant();
  const isV2 = variant === "v2";
  useEffect(() => { initCreditsStore(); }, []);

  const credits = useSyncExternalStore(
    subscribeCredits,
    getCreditsSnapshot,
    getCreditsSnapshot,
  );

  if (!isPermanentCreditsUser()) return null;

  const balance = credits.balance;

  return (
    <Link
      href="/credits"
      className={`inline-flex items-center gap-1.5 rounded-full py-1.5 pl-2 pr-3 shadow-sm transition active:scale-95 ${
        isV2
          ? "border border-[#c4a77d]/30 bg-[#1e2430]"
          : "border border-gray-100 bg-white"
      }`}
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${
          isV2
            ? "bg-gradient-to-br from-[#c4a77d] to-[#b8956a]"
            : "bg-gradient-to-br from-yellow-400 to-amber-500"
        }`}
      >
        $
      </span>
      <span
        className={`text-[14px] font-bold ${isV2 ? "text-[#E8E8E8]" : "text-gray-900"}`}
      >
        {balance}
      </span>
    </Link>
  );
}
