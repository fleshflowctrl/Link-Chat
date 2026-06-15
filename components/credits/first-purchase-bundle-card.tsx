"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { CreditPackage } from "@/data/credits";
import { CreditPrice } from "@/components/credits/credit-price";
import { bundleTotalUnits, bundleUnits } from "@/lib/credits/copy";
import { POINTS_PER_MESSAGE } from "@/lib/credits/pricing";
import { useAppVariant } from "@/components/app-variant-provider";
import { withVariantPath } from "@/lib/app-variant";

type Props = {
  pkg: CreditPackage;
  className?: string;
};

export function FirstPurchaseBundleCard({ pkg, className }: Props) {
  const { variant } = useAppVariant();
  const href = withVariantPath(`/credits/checkout/${pkg.id}`, variant);
  const messageCount = Math.floor((pkg.credits + pkg.bonus) / POINTS_PER_MESSAGE);

  return (
    <section className={className}>
      <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-[#B52B2A]">
        Eerste aankoop · eenmalig
      </p>

      <Link
        href={href}
        className="relative flex w-full flex-col gap-3 overflow-hidden rounded-2xl border-2 border-[#B52B2A]/50 bg-gradient-to-br from-[#1D1D1E] via-[#2A2A2B] to-[#1D1D1E] p-3.5 text-left shadow-lg shadow-[#B52B2A]/15 ring-1 ring-[#B52B2A]/30 transition active:scale-[0.99]"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[#B52B2A]/25 blur-2xl"
        />

        <div className="relative flex items-start gap-3">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl shadow-inner ring-1 ring-white/10">
            <Image
              src={`/assets/credits_${pkg.iconAsset}.png`}
              alt={pkg.bundleLabel}
              fill
              className="object-cover"
              sizes="56px"
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="inline-flex rounded-md bg-[#B52B2A] px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white shadow-sm">
                  {pkg.bundleLabel}
                </span>
                <p className="mt-2 text-[22px] font-extrabold leading-none tracking-tight text-white">
                  {bundleTotalUnits(pkg.credits, pkg.bonus)}
                </p>
                {pkg.bonus > 0 ? (
                  <p className="mt-1 text-[11px] font-medium text-white/55">
                    {bundleUnits(pkg.credits)} + bonus
                  </p>
                ) : null}
                <p className="mt-1 text-[12px] font-semibold leading-snug text-[#E8A8A7]">
                  {messageCount.toLocaleString("nl-NL")} berichten · alleen bij je eerste koop
                </p>
              </div>
              <ChevronRight
                className="mt-1 h-5 w-5 shrink-0 text-white/60"
                strokeWidth={2.5}
                aria-hidden
              />
            </div>
          </div>
        </div>

        <div className="relative flex items-end justify-between gap-2 border-t border-white/10 pt-2.5">
          <div>
            {pkg.original > pkg.price && (
              <p className="text-[11px] leading-none">
                <span className="inline-flex line-through decoration-white/70 decoration-1 [text-decoration-skip-ink:none]">
                  <CreditPrice
                    amount={pkg.original}
                    className="text-white/45"
                    mainClassName="text-[11px] font-semibold leading-none text-white/45"
                    centsClassName="text-[9px] font-semibold leading-none text-white/45"
                  />
                </span>
              </p>
            )}
            <CreditPrice
              amount={pkg.price}
              className="text-white"
              mainClassName="text-[22px] font-extrabold leading-none text-white"
              centsClassName="text-[13px] font-extrabold leading-none text-white/85"
            />
          </div>
          <span className="rounded-full bg-[#B52B2A] px-3 py-1.5 text-[11px] font-bold text-white">
            Pak welkomstaanbod
          </span>
        </div>
      </Link>
    </section>
  );
}
