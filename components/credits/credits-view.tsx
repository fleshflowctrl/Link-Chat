"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import Image from "next/image";
import { Check, Sparkles } from "lucide-react";
import { StatusBarMock } from "@/components/messages/status-bar-mock";
import { CreditsPill } from "@/components/ui/credits-pill";
import { packages, type CreditPackage } from "@/data/credits";
import {
  applyServerPurchaseUpdate,
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
  selected,
  onSelect,
  discount,
  tierLabel,
}: {
  pkg: CreditPackage;
  selected: boolean;
  onSelect: () => void;
  discount: number;
  tierLabel: string | null;
}) {
  const reserveTopRibbon =
    pkg.badge === "most-popular" ||
    pkg.badge === "trending" ||
    pkg.badge === "best-value";

  const userPrice = applyDiscount(pkg.price, discount);
  const struckPrice = discount > 0 ? pkg.price : pkg.original;
  const showStruck = struckPrice > userPrice;

  return (
    <div className="relative pt-1">
      {pkg.badge === "most-popular" && (
        <span className="absolute -top-2.5 left-3 z-10 rounded-md bg-[#7C5CFF] px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white shadow-sm">
          Meest populair
        </span>
      )}
      {pkg.badge === "trending" && (
        <span className="absolute -top-2.5 right-3 z-10 rounded-md bg-amber-400 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white shadow-sm">
          🔥 Hot
        </span>
      )}
      {pkg.badge === "best-value" && (
        <span className="absolute -top-2.5 right-3 z-10 rounded-md bg-emerald-500 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white shadow-sm">
          Beste deal
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
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl shadow-inner">
          <Image
            src={`/assets/credits_${pkg.credits}.png`}
            alt={`${pkg.credits} credits`}
            fill
            className="object-cover"
            sizes="48px"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-base font-bold text-ink">
              {pkg.credits} credits
            </span>
            {pkg.bonus > 0 && (
              <span className="rounded-full bg-pink-100 px-2 py-0.5 text-[10px] font-bold text-pink-600">
                +{pkg.bonus} extra
              </span>
            )}
          </div>
          {discount > 0 && tierLabel && (
            <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-emerald-700">
              <Sparkles className="h-3 w-3" strokeWidth={2.5} aria-hidden />
              {tierLabel} · -{formatDiscountPercent(discount)}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2 pr-0.5">
          <div className="text-right">
            <p className="text-[18px] font-bold leading-none text-ink">
              {formatMoney(userPrice)}
            </p>
            {showStruck && (
              <p className="mt-0.5 text-[11px] font-medium text-gray-400 line-through">
                {formatMoney(struckPrice)}
              </p>
            )}
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

  const defaultId =
    packages.find((p) => p.defaultSelected)?.id ?? packages[0].id;
  const [selectedId, setSelectedId] = useState(defaultId);
  const selected = useMemo(
    () => packages.find((p) => p.id === selectedId) ?? packages[0],
    [selectedId],
  );

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const userPrice = useMemo(
    () => applyDiscount(selected.price, discount),
    [selected.price, discount],
  );

  const handlePurchase = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/me/credits/purchase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ packageId: selected.id }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        balance?: number;
        purchaseCount?: number;
        grantedCredits?: number;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        setFeedback(json.error ?? "Aankoop mislukt. Probeer opnieuw.");
        return;
      }
      if (
        typeof json.balance === "number" &&
        typeof json.purchaseCount === "number"
      ) {
        applyServerPurchaseUpdate(json.balance, json.purchaseCount);
      }
      setFeedback(
        `+${json.grantedCredits ?? selected.credits + selected.bonus} credits toegevoegd`,
      );
    } catch {
      setFeedback("Aankoop mislukt. Probeer opnieuw.");
    } finally {
      setSubmitting(false);
    }
  }, [selected, submitting]);

  return (
    <div className="bg-[#F5F3EE] pb-8">
      <StatusBarMock />

      <header className="flex items-start justify-between gap-3 px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <div>
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-ink">
            Credits
          </h1>
          <p className="mt-1 text-[12px] text-gray-500">
            Stuur berichten en koppel met mensen
          </p>
        </div>
        <CreditsPill />
      </header>

      {discount > 0 && tierLabel && (
        <div className="mx-5 mb-3 flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-3 text-white shadow-md">
          <Sparkles className="h-5 w-5 shrink-0" strokeWidth={2.4} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-extrabold leading-tight">
              {tierLabel} bonus · {formatDiscountPercent(discount)} korting
            </p>
            <p className="text-[11px] leading-tight text-white/90">
              Geldig op je volgende aankoop. Daarna geldt de volgende prijs.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2.5 px-5 pb-4">
        {packages.map((pkg) => (
          <PackageCard
            key={pkg.id}
            pkg={pkg}
            selected={selectedId === pkg.id}
            onSelect={() => setSelectedId(pkg.id)}
            discount={discount}
            tierLabel={tierLabel}
          />
        ))}
      </div>

      <div className="flex flex-col gap-2 px-5 pt-2">
        {feedback && (
          <p className="rounded-xl bg-emerald-50 px-3 py-2 text-center text-[12px] font-bold text-emerald-700">
            {feedback}
          </p>
        )}
        <button
          type="button"
          onClick={handlePurchase}
          disabled={submitting}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-black px-5 py-3.5 text-[15px] font-bold text-white shadow-lg transition active:scale-[0.99] disabled:opacity-60"
        >
          <svg
            className="h-6 w-6 shrink-0"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
          >
            <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
          </svg>
          <span>
            {submitting ? "Bezig…" : `Betaal · ${formatMoney(userPrice)}`}
          </span>
        </button>
        <button
          type="button"
          onClick={handlePurchase}
          disabled={submitting}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-3 text-[15px] font-semibold text-ink shadow-sm transition active:scale-[0.99] disabled:opacity-60"
        >
          <span aria-hidden>💳</span>
          <span>Betalen met kaart</span>
        </button>
      </div>
    </div>
  );
}
