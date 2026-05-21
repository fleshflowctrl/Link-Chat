"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BadgeCheck, ShieldCheck, Sparkles } from "lucide-react";
import { CreditsPill } from "@/components/ui/credits-pill";
import {
  PRO_SUBSCRIPTION_COMPARE_PRICE_EUR,
  PRO_SUBSCRIPTION_CREDITS_PER_MONTH,
  PRO_SUBSCRIPTION_PRICE_EUR,
  proSubscriptionDiscountPercent,
} from "@/lib/credits/pro-subscription";
import {
  applyServerCreditsUpdate,
  getCreditsSnapshot,
  initCreditsStore,
  subscribeCredits,
} from "@/lib/credits-store";
import { CreditPrice } from "@/components/credits/credit-price";
import { useAppVariant } from "@/components/app-variant-provider";
import { withVariantPath } from "@/lib/app-variant";

type CheckoutQuery = {
  success?: string;
  canceled?: string;
  session_id?: string;
};

export function ProCheckoutView({ query = {} }: { query?: CheckoutQuery }) {
  const router = useRouter();
  const { variant } = useAppVariant();
  const discountPercent = proSubscriptionDiscountPercent();
  const creditsPath = withVariantPath("/credits", variant);
  const verifiedSession = useRef<string | null>(null);

  useEffect(() => {
    initCreditsStore();
  }, []);

  const creditsSnap = useSyncExternalStore(
    subscribeCredits,
    getCreditsSnapshot,
    getCreditsSnapshot,
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [canceled, setCanceled] = useState(query.canceled === "1");

  const applyGrantResult = useCallback(
    (json: { balance?: number; grantedCredits?: number }) => {
      if (typeof json.balance === "number") {
        applyServerCreditsUpdate(json.balance);
      }
      setSuccess(
        `Pro actief · +${json.grantedCredits ?? PRO_SUBSCRIPTION_CREDITS_PER_MONTH} credits`,
      );
      setTimeout(() => router.push(creditsPath), 900);
    },
    [router, creditsPath],
  );

  useEffect(() => {
    const sessionId = query.session_id?.trim();
    if (query.success !== "1" || !sessionId) return;
    if (verifiedSession.current === sessionId) return;
    verifiedSession.current = sessionId;

    let cancelled = false;
    (async () => {
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/me/credits/pro-subscription/verify?session_id=${encodeURIComponent(sessionId)}`,
        );
        const json = (await res.json()) as {
          ok?: boolean;
          balance?: number;
          grantedCredits?: number;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !json.ok) {
          setError(json.error ?? "Betaling kon niet worden bevestigd.");
          return;
        }
        applyGrantResult(json);
      } catch {
        if (!cancelled) setError("Betaling kon niet worden bevestigd.");
      } finally {
        if (!cancelled) setSubmitting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [query.success, query.session_id, applyGrantResult]);

  const startCheckout = useCallback(async () => {
    const res = await fetch("/api/me/credits/pro-subscription/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
    });
    const json = (await res.json()) as {
      ok?: boolean;
      url?: string;
      devMode?: boolean;
      error?: string;
      code?: string;
    };
    if (json.code === "already_subscribed") {
      setError("Je hebt Pro al actief.");
      return false;
    }
    if (!res.ok || !json.ok) {
      setError(json.error ?? "Checkout mislukt.");
      return false;
    }
    if (json.url) {
      window.location.href = json.url;
      return true;
    }
    setError("Geen betaallink ontvangen.");
    return false;
  }, []);

  const onPay = useCallback(async () => {
    if (submitting || success) return;
    setSubmitting(true);
    setError(null);
    setCanceled(false);
    try {
      await startCheckout();
    } finally {
      setSubmitting(false);
    }
  }, [submitting, success, startCheckout]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-canvas">
      <header className="shrink-0 border-b border-black/[0.06] px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between gap-3">
          <Link
            href={creditsPath}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm transition active:scale-95"
            aria-label="Terug naar credits"
          >
            <ArrowLeft className="h-5 w-5 text-ink" strokeWidth={2.25} />
          </Link>
          <CreditsPill />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-5">
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-[#B52B2A]">
          Eenmalige aanbieding
        </p>
        <h1 className="mt-2 text-center text-[26px] font-extrabold leading-tight text-ink">
          Pro abonnement
        </h1>
        <p className="mt-1 text-center text-[15px] font-semibold text-gray-700">
          {PRO_SUBSCRIPTION_CREDITS_PER_MONTH.toLocaleString("nl-NL")} credits
          elke maand
        </p>

        <div className="relative mx-auto mt-6 w-full max-w-sm rounded-2xl border-2 border-[#B52B2A]/40 bg-gradient-to-br from-[#1D1D1E] to-[#2A2A2B] p-5 text-white shadow-lg">
          {discountPercent > 0 && (
            <span className="absolute right-4 top-4 rounded-md bg-emerald-500 px-2.5 py-1 text-[11px] font-extrabold tabular-nums text-white shadow-sm">
              −{discountPercent}%
            </span>
          )}
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-[#B52B2A]" aria-hidden />
            <span className="text-[20px] font-extrabold">Pro</span>
          </div>
          <p className="mt-3 text-[32px] font-extrabold leading-none text-white">
            <CreditPrice
              amount={PRO_SUBSCRIPTION_PRICE_EUR}
              className="text-white"
              mainClassName="text-[32px] font-extrabold leading-none text-white"
              centsClassName="text-[16px] font-extrabold leading-none text-white/85"
            />
            <span className="text-[14px] font-bold text-white/70"> / maand</span>
          </p>
          <p className="mt-1 text-[12px] text-white/50 line-through">
            vs €{PRO_SUBSCRIPTION_COMPARE_PRICE_EUR.toFixed(2).replace(".", ",")}{" "}
            eenmalig voor {PRO_SUBSCRIPTION_CREDITS_PER_MONTH} credits
          </p>
          <ul className="mt-4 space-y-2 text-[13px] leading-snug text-white/85">
            <li className="flex gap-2">
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              {PRO_SUBSCRIPTION_CREDITS_PER_MONTH} credits direct bij elke betaling
            </li>
            <li className="flex gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              Veilig betalen via Stripe
            </li>
          </ul>
        </div>

        {canceled && (
          <p className="mt-4 text-center text-[13px] text-amber-700">
            Betaling geannuleerd. Je kunt het opnieuw proberen.
          </p>
        )}
        {error && (
          <p className="mt-4 text-center text-[13px] font-medium text-red-600">
            {error}
          </p>
        )}
        {success && (
          <p className="mt-4 text-center text-[13px] font-medium text-emerald-700">
            {success}
          </p>
        )}

        <p className="mt-4 text-center text-[11px] leading-snug text-gray-500">
          Huidig saldo: {creditsSnap.balance} credits
        </p>
      </div>

      <div className="shrink-0 border-t border-black/[0.06] bg-canvas/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <button
          type="button"
          disabled={submitting || Boolean(success)}
          onClick={() => void onPay()}
          className="flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[#B52B2A] to-[#D94A48] py-3.5 text-[15px] font-extrabold text-white shadow-lg transition active:scale-[0.98] disabled:opacity-60"
        >
          {submitting
            ? "Even geduld…"
            : `Start Pro · ${PRO_SUBSCRIPTION_PRICE_EUR.toFixed(2).replace(".", ",")} / maand`}
        </button>
      </div>
    </div>
  );
}
