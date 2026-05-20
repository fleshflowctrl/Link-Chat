"use client";

import { useEffect, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CreditsPill } from "@/components/ui/credits-pill";
import { packages, type CreditPackage } from "@/data/credits";
import {
  getCreditsSnapshot,
  initCreditsStore,
  subscribeCredits,
} from "@/lib/credits-store";
import { CreditPrice } from "@/components/credits/credit-price";

function PackageCard({ pkg }: { pkg: CreditPackage }) {
  const hasRibbon = pkg.badge === "trending" || pkg.badge === "best-value";

  const cardRingClass =
    pkg.badge === "trending"
      ? "ring-2 ring-amber-400"
      : pkg.badge === "best-value"
        ? "ring-2 ring-emerald-500"
        : "ring-1 ring-black/[0.05]";

  return (
    <div className="relative">
      {pkg.badge === "trending" && (
        <span className="absolute -top-2 right-3 z-10 rounded-md bg-amber-400 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white shadow-sm">
          🔥 Hot
        </span>
      )}
      {pkg.badge === "best-value" && (
        <span className="absolute -top-2 right-3 z-10 rounded-md bg-emerald-500 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white shadow-sm">
          Beste deal
        </span>
      )}

      <Link
        href={`/credits/checkout/${pkg.id}`}
        className={`relative flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm transition active:scale-[0.99] ${cardRingClass} ${
          hasRibbon ? "mt-2" : ""
        }`}
      >
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl shadow-inner">
          <Image
            src={`/assets/credits_${pkg.iconAsset}.png`}
            alt={`${pkg.credits} credits`}
            fill
            className="object-cover"
            sizes="44px"
          />
        </div>

        <div className="min-w-0 flex-1">
          <span className="text-[15px] font-bold text-ink">
            {pkg.credits} credits
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2 pr-0.5">
          <CreditPrice amount={pkg.price} />
          <ChevronRight
            className="h-4 w-4 shrink-0 text-gray-400"
            strokeWidth={2.5}
            aria-hidden
          />
        </div>
      </Link>
    </div>
  );
}

export function CreditsView() {
  useEffect(() => {
    initCreditsStore();
  }, []);

  useSyncExternalStore(subscribeCredits, getCreditsSnapshot, getCreditsSnapshot);

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas">
      <header className="shrink-0 px-5 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink">
              Credits
            </h1>
            <p className="mt-0.5 text-[12px] text-gray-500">
              Stuur berichten en koppel met mensen
            </p>
          </div>
          <CreditsPill />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col justify-start gap-2 overflow-y-auto px-5 pb-5 pt-1">
        {packages.map((pkg) => (
          <PackageCard key={pkg.id} pkg={pkg} />
        ))}
      </div>
    </div>
  );
}
