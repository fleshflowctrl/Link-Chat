"use client";

import { useEffect, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CreditsPill } from "@/components/ui/credits-pill";
import { bonusPackages, starterPackage, firstPurchasePackage, type CreditPackage } from "@/data/credits";
import { FirstPurchaseBundleCard } from "@/components/credits/first-purchase-bundle-card";
import {
  getCreditsSnapshot,
  initCreditsStore,
  subscribeCredits,
} from "@/lib/credits-store";
import { BUNDLES_SUBTITLE, BUNDLES_TITLE } from "@/lib/credits/copy";
import { CreditPrice } from "@/components/credits/credit-price";
import {
  PackageBonusBadge,
  PackagePointsSummary,
} from "@/components/credits/package-points-summary";
import { useAppVariant } from "@/components/app-variant-provider";
import { withVariantPath } from "@/lib/app-variant";

function PackageCard({
  pkg,
  tone = "light",
}: {
  pkg: CreditPackage;
  tone?: "light" | "dark";
}) {
  const { variant } = useAppVariant();
  const isDark = tone === "dark";

  return (
    <div className="relative">
      <Link
        href={withVariantPath(`/credits/checkout/${pkg.id}`, variant)}
        className={
          isDark
            ? "relative flex w-full items-center gap-3 rounded-2xl bg-[#2A2A2B] p-3 text-left ring-1 ring-white/[0.08] transition active:scale-[0.99]"
            : "relative flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm ring-1 ring-black/[0.05] transition active:scale-[0.99]"
        }
      >
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl shadow-inner">
          <Image
            src={`/assets/credits_${pkg.iconAsset}.png`}
            alt={pkg.bundleLabel}
            fill
            className="object-cover"
            sizes="44px"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <p
              className={
                isDark
                  ? "text-[15px] font-bold leading-snug text-white"
                  : "text-[15px] font-bold leading-snug text-ink"
              }
            >
              {pkg.bundleLabel}
            </p>
            <PackageBonusBadge bonus={pkg.bonus} />
          </div>
          <p
            className={
              isDark
                ? "mt-0.5 text-[11px] leading-snug text-white/55"
                : "mt-0.5 text-[11px] leading-snug text-inkMuted"
            }
          >
            {pkg.bundleDescription}
          </p>
          <PackagePointsSummary pkg={pkg} compact tone={tone} />
        </div>

        <div className="flex shrink-0 items-center gap-2 pr-0.5">
          <CreditPrice
            amount={pkg.price}
            className={isDark ? "text-white" : undefined}
            mainClassName={
              isDark
                ? "text-[16px] font-bold leading-none text-white"
                : "text-[16px] font-bold leading-none"
            }
            centsClassName={
              isDark
                ? "text-[10px] font-bold leading-none text-white/85"
                : "text-[10px] font-bold leading-none opacity-85"
            }
          />
          <ChevronRight
            className={`h-4 w-4 shrink-0 ${isDark ? "text-white/45" : "text-gray-400"}`}
            strokeWidth={2.5}
            aria-hidden
          />
        </div>
      </Link>
    </div>
  );
}

function BonusBundlesSection({ packages: bonusPkgs }: { packages: CreditPackage[] }) {
  if (bonusPkgs.length === 0) return null;

  return (
    <section className="space-y-2">
            <p className="px-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">
              Meer gespreksruimte
            </p>
      <div className="space-y-2">
        {bonusPkgs.map((pkg) => (
          <PackageCard key={pkg.id} pkg={pkg} tone="dark" />
        ))}
      </div>
    </section>
  );
}

export function CreditsView() {
  useEffect(() => {
    initCreditsStore();
  }, []);

  const { purchaseCount } = useSyncExternalStore(
    subscribeCredits,
    getCreditsSnapshot,
    getCreditsSnapshot,
  );
  const showFirstPurchaseOffer = purchaseCount === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-canvas">
      <header className="shrink-0 px-5 pb-1.5 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[26px] font-bold leading-tight tracking-tight text-ink">
              {BUNDLES_TITLE}
            </h1>
            <p className="mt-0.5 text-[12px] text-gray-500">{BUNDLES_SUBTITLE}</p>
          </div>
          <CreditsPill />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-0.5">
        {showFirstPurchaseOffer ? (
          <FirstPurchaseBundleCard pkg={firstPurchasePackage} />
        ) : null}

        <div className="space-y-3">
          <section className="space-y-2">
            <p className="px-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/70">
              Start hier
            </p>
            <PackageCard pkg={starterPackage} />
          </section>

          <BonusBundlesSection packages={bonusPackages} />
        </div>
      </div>
    </div>
  );
}
