"use client";

import Link from "next/link";
import { ChevronRight, Sparkles } from "lucide-react";
import {
  PRO_SUBSCRIPTION_COMPARE_PRICE_EUR,
  PRO_SUBSCRIPTION_CREDITS_PER_MONTH,
  PRO_SUBSCRIPTION_PRICE_EUR,
  proSubscriptionDiscountPercent,
} from "@/lib/credits/pro-subscription";
import { CreditPrice } from "@/components/credits/credit-price";
import { useAppVariant } from "@/components/app-variant-provider";
import { withVariantPath } from "@/lib/app-variant";

type Props = {
  active?: boolean;
  /** Optional wrapper overrides (e.g. drop top margin on the credits tab). */
  className?: string;
};

export function ProOfferCard({ active = false, className }: Props) {
  const { variant } = useAppVariant();
  const href = withVariantPath("/credits/checkout/pro", variant);
  const discountPercent = proSubscriptionDiscountPercent();

  return (
    <section className={className ?? "mt-4 pt-2"}>
      <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-[#B52B2A]">
        Eenmalige aanbieding
      </p>

      {active ? (
        <div className="rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-50 to-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-600" aria-hidden />
            <span className="text-[16px] font-extrabold text-ink">Pro actief</span>
          </div>
          <p className="mt-2 text-[12px] leading-snug text-gray-600">
            Je ontvangt elke maand {PRO_SUBSCRIPTION_CREDITS_PER_MONTH} credits.
          </p>
        </div>
      ) : (
        <Link
          href={href}
          className="relative flex w-full flex-col gap-2 overflow-hidden rounded-2xl border-2 border-[#B52B2A]/60 bg-gradient-to-br from-[#1D1D1E] via-[#2A2A2B] to-[#1D1D1E] p-3.5 text-left shadow-lg shadow-[#B52B2A]/20 ring-1 ring-[#B52B2A]/40 transition active:scale-[0.99]"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[#B52B2A]/25 blur-2xl"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-md bg-[#B52B2A] px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white shadow-sm">
              Pro pakket
            </span>
            {discountPercent > 0 && (
              <span className="rounded-md bg-emerald-500 px-2.5 py-0.5 text-[10px] font-extrabold tabular-nums text-white shadow-sm">
                −{discountPercent}%
              </span>
            )}
          </div>

          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[22px] font-extrabold leading-none tracking-tight text-white">
                {PRO_SUBSCRIPTION_CREDITS_PER_MONTH.toLocaleString("nl-NL")}
                <span className="text-[15px] font-bold text-white/90">
                  {" "}
                  credits
                </span>
              </p>
              <p className="mt-1.5 text-[12px] font-semibold leading-snug text-[#E8A8A7]">
                per maand · maandelijks abonnement
              </p>
            </div>
            <ChevronRight
              className="mt-1 h-5 w-5 shrink-0 text-white/60"
              strokeWidth={2.5}
              aria-hidden
            />
          </div>

          <div className="flex items-end justify-between gap-2 border-t border-white/10 pt-2.5">
            <div>
              <p className="text-[11px] text-white/50 line-through">
                €{PRO_SUBSCRIPTION_COMPARE_PRICE_EUR.toFixed(2).replace(".", ",")}{" "}
                eenmalig
              </p>
              <p className="text-[22px] font-extrabold text-white">
                <CreditPrice
                  amount={PRO_SUBSCRIPTION_PRICE_EUR}
                  className="text-white"
                  mainClassName="text-[22px] font-extrabold leading-none text-white"
                  centsClassName="text-[13px] font-extrabold leading-none text-white/85"
                />
                <span className="text-[13px] font-bold text-white/70"> / maand</span>
              </p>
            </div>
            <span className="rounded-full bg-[#B52B2A] px-3 py-1.5 text-[11px] font-bold text-white">
              Bekijk aanbod →
            </span>
          </div>
        </Link>
      )}
    </section>
  );
}
