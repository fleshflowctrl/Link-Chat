"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";
import { CreditsPill } from "@/components/ui/credits-pill";
import { packages, type CreditPackage } from "@/data/credits";
import {
  getCreditsSnapshot,
  initCreditsStore,
  subscribeCredits,
} from "@/lib/credits-store";
import {
  applyDiscount,
  discountForNextPurchase,
  formatDiscountPercent,
  purchaseTierLabel,
} from "@/lib/credits/discount";

function formatMoney(n: number): string {
  return n.toLocaleString("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function PackageCard({
  pkg,
  discount,
}: {
  pkg: CreditPackage;
  discount: number;
}) {
  const userPrice = applyDiscount(pkg.price, discount);
  const struckPrice = discount > 0 ? pkg.price : pkg.original;
  const showStruck = struckPrice > userPrice;

  const reserveTopRibbon =
    pkg.badge === "most-popular" ||
    pkg.badge === "trending" ||
    pkg.badge === "best-value";

  return (
    <div className="relative">
      {pkg.badge === "most-popular" && (
        <span className="absolute -top-2 left-3 z-10 rounded-md bg-[#7C5CFF] px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white shadow-sm">
          Meest populair
        </span>
      )}
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
        className={`relative flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm ring-1 ring-black/[0.05] transition active:scale-[0.99] ${
          reserveTopRibbon ? "mt-2" : ""
        }`}
      >
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl shadow-inner">
          <Image
            src={`/assets/credits_${pkg.credits}.png`}
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
          <div className="text-right">
            <p className="text-[16px] font-bold leading-none text-ink">
              {formatMoney(userPrice)}
            </p>
            {showStruck && (
              <p className="mt-0.5 text-[10px] font-medium text-gray-400 line-through">
                {formatMoney(struckPrice)}
              </p>
            )}
          </div>
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

  const snapshot = useSyncExternalStore(
    subscribeCredits,
    getCreditsSnapshot,
    getCreditsSnapshot,
  );
  const purchaseCount = snapshot.purchaseCount;
  const discount = useMemo(
    () => discountForNextPurchase(purchaseCount),
    [purchaseCount],
  );
  const tierLabel = useMemo(
    () => purchaseTierLabel(purchaseCount),
    [purchaseCount],
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#F5F3EE]">
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

      {discount > 0 && tierLabel && (
        <div className="mx-5 mb-2 flex shrink-0 items-center gap-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2.5 text-white shadow-md">
          <Sparkles className="h-5 w-5 shrink-0" strokeWidth={2.4} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-extrabold leading-tight">
              {tierLabel} bonus · {formatDiscountPercent(discount)} korting
            </p>
            <p className="text-[11px] leading-tight text-white/90">
              Geldig op je volgende aankoop.
            </p>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col justify-start gap-2 overflow-y-auto px-5 pb-5 pt-1">
        {packages.map((pkg) => (
          <PackageCard key={pkg.id} pkg={pkg} discount={discount} />
        ))}
      </div>
    </div>
  );
}
