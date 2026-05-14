"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BadgeCheck, ShieldCheck, Sparkles } from "lucide-react";
import { CreditsPill } from "@/components/ui/credits-pill";
import { type CreditPackage } from "@/data/credits";
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

export function CheckoutView({ pkg }: { pkg: CreditPackage }) {
  const router = useRouter();

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

  const userPrice = useMemo(
    () => applyDiscount(pkg.price, discount),
    [pkg.price, discount],
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handlePurchase = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/me/credits/purchase", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ packageId: pkg.id }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        balance?: number;
        purchaseCount?: number;
        grantedCredits?: number;
        error?: string;
      };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Aankoop mislukt. Probeer opnieuw.");
        return;
      }
      if (
        typeof json.balance === "number" &&
        typeof json.purchaseCount === "number"
      ) {
        applyServerPurchaseUpdate(json.balance, json.purchaseCount);
      }
      setSuccess(
        `+${json.grantedCredits ?? pkg.credits + pkg.bonus} credits toegevoegd`,
      );
      // Take the user back to the credits screen so they see the new tier.
      setTimeout(() => router.push("/credits"), 900);
    } catch {
      setError("Aankoop mislukt. Probeer opnieuw.");
    } finally {
      setSubmitting(false);
    }
  }, [pkg, submitting, router]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#F5F3EE]">
      <header className="shrink-0 px-5 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/credits"
            aria-label="Terug naar credits"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/5 transition active:scale-95"
          >
            <ArrowLeft className="h-5 w-5 text-ink" strokeWidth={2.5} aria-hidden />
          </Link>
          <h1 className="text-[18px] font-bold tracking-tight text-ink">
            Afrekenen
          </h1>
          <CreditsPill />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pb-5">
        {/* Order summary */}
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/[0.05]">
          <div className="flex items-center gap-3">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl shadow-inner">
              <Image
                src={`/assets/credits_${pkg.credits}.png`}
                alt={`${pkg.credits} credits`}
                fill
                className="object-cover"
                sizes="56px"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[18px] font-extrabold leading-tight tracking-tight text-ink">
                {pkg.credits} credits
              </p>
              {pkg.bonus > 0 && (
                <p className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-pink-100 px-2 py-0.5 text-[10px] font-bold text-pink-600">
                  +{pkg.bonus} bonus credits gratis
                </p>
              )}
            </div>
          </div>

          {discount > 0 && tierLabel && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-emerald-700">
              <Sparkles className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
              <p className="text-[12px] font-extrabold uppercase tracking-wide">
                {tierLabel} · -{formatDiscountPercent(discount)}
              </p>
            </div>
          )}

          <div className="mt-4 space-y-1.5 text-[13px]">
            <div className="flex items-center justify-between text-gray-600">
              <span>Subtotaal</span>
              <span className="tabular-nums">{formatMoney(pkg.price)}</span>
            </div>
            {discount > 0 && (
              <div className="flex items-center justify-between text-emerald-700">
                <span>Korting ({formatDiscountPercent(discount)})</span>
                <span className="tabular-nums">
                  -{formatMoney(pkg.price - userPrice)}
                </span>
              </div>
            )}
            <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2 text-ink">
              <span className="text-[14px] font-bold">Te betalen</span>
              <span className="text-[20px] font-extrabold tabular-nums">
                {formatMoney(userPrice)}
              </span>
            </div>
          </div>
        </div>

        {/* Trust strip */}
        <div className="flex items-center justify-center gap-2 text-[11px] font-medium text-gray-500">
          <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
          Veilig betalen via Apple Pay of kaart
        </div>

        <div className="mt-auto flex flex-col gap-2">
          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-[12px] font-medium text-red-700">
              {error}
            </p>
          )}
          {success && (
            <p className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-center text-[12px] font-bold text-emerald-700">
              <BadgeCheck className="h-4 w-4" strokeWidth={2.5} aria-hidden />
              {success}
            </p>
          )}

          <button
            type="button"
            onClick={handlePurchase}
            disabled={submitting || success !== null}
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
              {submitting
                ? "Bezig…"
                : success
                  ? "Voltooid"
                  : `Betaal · ${formatMoney(userPrice)}`}
            </span>
          </button>
          <button
            type="button"
            onClick={handlePurchase}
            disabled={submitting || success !== null}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-5 py-3 text-[15px] font-semibold text-ink shadow-sm transition active:scale-[0.99] disabled:opacity-60"
          >
            <span aria-hidden>💳</span>
            <span>Betalen met kaart</span>
          </button>
        </div>
      </div>
    </div>
  );
}
