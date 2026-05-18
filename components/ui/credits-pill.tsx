"use client";

import { VariantLink as Link } from "@/components/variant-link";
import { useEffect, useSyncExternalStore } from "react";
import {
  getCreditsSnapshot,
  initCreditsStore,
  subscribeCredits,
} from "@/lib/credits-store";

/**
 * Consistent credits-balance pill used in every page header.
 * Reads live from credits-store — no props needed.
 */
export function CreditsPill() {
  useEffect(() => { initCreditsStore(); }, []);

  const balance = useSyncExternalStore(
    subscribeCredits,
    getCreditsSnapshot,
    getCreditsSnapshot,
  ).balance;

  return (
    <Link
      href="/credits"
      className="inline-flex items-center gap-1.5 rounded-full border border-gray-100 bg-white py-1.5 pl-2 pr-3 shadow-sm transition active:scale-95"
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 text-[11px] font-bold text-white">
        $
      </span>
      <span className="text-[14px] font-bold text-gray-900">{balance}</span>
    </Link>
  );
}
