"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  ChevronLeft,
  CreditCard,
  Lock,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { StatusBarMock } from "@/components/messages/status-bar-mock";
import {
  type CardBrand,
  type SavedPaymentMethod,
  brandLabel,
  cvcValid,
  detectBrand,
  expiryNotPast,
  formatCardNumber,
  formatExpiry,
  luhnValid,
  parseExpiry,
} from "@/lib/payment/cards";

/* ─────────────────── visual helpers ──────────────────────────── */

function BrandBadge({ brand }: { brand: CardBrand }) {
  const styles: Record<CardBrand, { bg: string; text: string; label: string }> = {
    visa: { bg: "bg-[#1A1F71]", text: "text-white", label: "VISA" },
    mastercard: { bg: "bg-[#EB001B]", text: "text-white", label: "MC" },
    amex: { bg: "bg-[#2E77BC]", text: "text-white", label: "AMEX" },
    discover: { bg: "bg-[#FF6000]", text: "text-white", label: "DISC" },
    diners: { bg: "bg-[#0079BE]", text: "text-white", label: "DINE" },
    jcb: { bg: "bg-[#0E4C96]", text: "text-white", label: "JCB" },
    unionpay: { bg: "bg-[#E21836]", text: "text-white", label: "UP" },
    maestro: { bg: "bg-[#0099DF]", text: "text-white", label: "MAES" },
    unknown: { bg: "bg-gray-200", text: "text-gray-700", label: "CARD" },
  };
  const s = styles[brand];
  return (
    <span
      className={`inline-flex h-7 w-12 shrink-0 items-center justify-center rounded-md text-[10px] font-extrabold tracking-wider ${s.bg} ${s.text}`}
    >
      {s.label}
    </span>
  );
}

function PaymentMethodRow({
  method,
  busy,
  onSetDefault,
  onDelete,
}: {
  method: SavedPaymentMethod;
  busy: boolean;
  onSetDefault: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const expStr = `${String(method.expMonth).padStart(2, "0")}/${String(method.expYear).slice(-2)}`;
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <BrandBadge brand={method.brand} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-[14px] font-bold text-ink">
            {brandLabel(method.brand)} •••• {method.last4}
          </p>
          {method.isDefault && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
              <CheckCircle2 className="h-3 w-3" strokeWidth={2.5} aria-hidden />
              Standaard
            </span>
          )}
        </div>
        <p className="text-[11.5px] text-gray-500">
          Vervalt {expStr}
          {method.holderName ? ` · ${method.holderName}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {!method.isDefault && (
          <button
            type="button"
            onClick={() => onSetDefault(method.id)}
            disabled={busy}
            className="rounded-full px-2.5 py-1 text-[11px] font-bold text-[#7C5CFF] transition active:scale-95 disabled:opacity-50"
          >
            Maak standaard
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(method.id)}
          disabled={busy}
          aria-label="Verwijder kaart"
          className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:text-red-500 active:scale-90 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" strokeWidth={2.25} />
        </button>
      </div>
    </div>
  );
}

/* ─────────────────── add card sheet ───────────────────────────── */

function AddCardSheet({
  onClose,
  onAdded,
  forceDefault,
}: {
  onClose: () => void;
  onAdded: (m: SavedPaymentMethod) => void;
  /** First card auto-becomes default. Reflect that in the toggle. */
  forceDefault: boolean;
}) {
  const [number, setNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [holder, setHolder] = useState("");
  const [setDefault, setSetDefault] = useState(forceDefault);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numberDigits = useMemo(() => number.replace(/\D/g, ""), [number]);
  const brand = detectBrand(numberDigits);
  const numOk = luhnValid(numberDigits);
  const parsed = parseExpiry(expiry);
  const expOk = parsed != null && expiryNotPast(parsed.month, parsed.year);
  const cvcOk = cvcValid(cvc, brand);
  const formOk = numOk && expOk && cvcOk;

  async function handleSubmit() {
    if (!formOk || submitting || !parsed) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/me/payment-methods", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          number: numberDigits,
          expMonth: parsed.month,
          expYear: parsed.year,
          holderName: holder.trim(),
          setDefault: forceDefault || setDefault,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        method?: SavedPaymentMethod;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.method) {
        setError(data.error ?? "Kaart toevoegen mislukt");
        return;
      }
      onAdded(data.method);
    } catch {
      setError("Netwerkfout — probeer opnieuw");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <motion.div
        key="addcard-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[280] bg-black/40"
        onClick={onClose}
      />
      <motion.div
        key="addcard-sheet"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 280, damping: 32 }}
        className="fixed inset-x-0 bottom-0 z-[290] mx-auto max-w-[430px] rounded-t-[28px] bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[18px] font-bold text-ink">Kaart toevoegen</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Sluiten"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition active:scale-95"
          >
            <X className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-bold uppercase tracking-wider text-gray-500">
              Kaartnummer
            </span>
            <div className="flex items-center gap-2 rounded-2xl bg-gray-50 px-3.5 ring-1 ring-gray-200 focus-within:ring-2 focus-within:ring-[#7C5CFF]">
              <CreditCard className="h-4 w-4 shrink-0 text-gray-400" aria-hidden />
              <input
                inputMode="numeric"
                autoComplete="cc-number"
                placeholder="1234 5678 9012 3456"
                value={number}
                onChange={(e) => setNumber(formatCardNumber(e.target.value))}
                className="h-12 min-w-0 flex-1 bg-transparent text-[15px] tabular-nums text-ink outline-none placeholder:text-gray-400"
              />
              <BrandBadge brand={brand} />
            </div>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-bold uppercase tracking-wider text-gray-500">
                Vervalt
              </span>
              <input
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="MM/YY"
                value={expiry}
                onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                className="h-12 w-full rounded-2xl bg-gray-50 px-3.5 text-[15px] tabular-nums text-ink outline-none ring-1 ring-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-[#7C5CFF]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-bold uppercase tracking-wider text-gray-500">
                CVC
              </span>
              <input
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder={brand === "amex" ? "4 cijfers" : "3 cijfers"}
                value={cvc}
                maxLength={4}
                onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="h-12 w-full rounded-2xl bg-gray-50 px-3.5 text-[15px] tabular-nums text-ink outline-none ring-1 ring-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-[#7C5CFF]"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-[11.5px] font-bold uppercase tracking-wider text-gray-500">
              Naam op kaart
            </span>
            <input
              type="text"
              autoComplete="cc-name"
              placeholder="Voornaam Achternaam"
              value={holder}
              onChange={(e) => setHolder(e.target.value.slice(0, 60))}
              className="h-12 w-full rounded-2xl bg-gray-50 px-3.5 text-[15px] text-ink outline-none ring-1 ring-gray-200 placeholder:text-gray-400 focus:ring-2 focus:ring-[#7C5CFF]"
            />
          </label>

          {!forceDefault && (
            <label className="flex cursor-pointer items-center gap-2 pt-1">
              <input
                type="checkbox"
                checked={setDefault}
                onChange={(e) => setSetDefault(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-[#7C5CFF] focus:ring-[#7C5CFF]"
              />
              <span className="text-[12.5px] text-gray-700">
                Maak deze kaart standaard
              </span>
            </label>
          )}

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-[12px] font-semibold text-red-600 ring-1 ring-red-100">
              {error}
            </p>
          )}

          <p className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-gray-500">
            <Lock className="h-3 w-3" strokeWidth={2.25} aria-hidden />
            Kaartgegevens worden veilig verwerkt. CVC wordt nooit opgeslagen.
          </p>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!formOk || submitting}
            className="mt-1 flex h-12 w-full items-center justify-center rounded-2xl bg-ink text-[14px] font-bold text-white shadow-sm transition active:scale-[0.99] disabled:opacity-50"
          >
            {submitting ? "Bezig…" : "Kaart opslaan"}
          </button>
        </div>
      </motion.div>
    </>
  );
}

/* ─────────────────── main page ────────────────────────────────── */

const PAYMENT_METHODS_CACHE_KEY = "whisper_payment_methods_v1";

function readCache(): SavedPaymentMethod[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PAYMENT_METHODS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as SavedPaymentMethod[]) : null;
  } catch {
    return null;
  }
}

function writeCache(methods: SavedPaymentMethod[]): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(PAYMENT_METHODS_CACHE_KEY, JSON.stringify(methods));
  } catch {
    /* quota / privacy mode — ignore */
  }
}

export function PaymentMethodsView({
  initialMethods,
}: {
  initialMethods?: SavedPaymentMethod[];
}) {
  // Server-rendered data wins on first paint; fall back to in-session cache so
  // anonymous/local navigations still feel instant. Empty array is a valid
  // "loaded" state — we never show a skeleton when we already know the answer.
  const [methods, setMethods] = useState<SavedPaymentMethod[] | null>(() => {
    if (initialMethods !== undefined) return initialMethods;
    const cached = readCache();
    return cached ?? null;
  });
  const [busyIds, setBusyIds] = useState<Set<string>>(() => new Set());
  const [adding, setAdding] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 2400);
  }

  function setBusy(id: string, busy: boolean) {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  // Persist server snapshot to the in-session cache so subsequent client-side
  // navigations to this page render instantly without waiting for the server
  // round-trip.
  useEffect(() => {
    if (initialMethods !== undefined) writeCache(initialMethods);
  }, [initialMethods]);

  // Silent background re-sync to catch out-of-band changes (e.g. another tab).
  // Skipped when we already trust server-rendered data on initial paint.
  useEffect(() => {
    if (initialMethods !== undefined) return;
    let cancelled = false;
    void fetch("/api/me/payment-methods", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { ok?: boolean; methods?: SavedPaymentMethod[] } | null) => {
        if (cancelled) return;
        const fresh = data?.ok && Array.isArray(data.methods) ? data.methods : [];
        setMethods(fresh);
        writeCache(fresh);
      })
      .catch(() => {
        if (!cancelled) setMethods((m) => m ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [initialMethods]);

  async function handleSetDefault(id: string) {
    setBusy(id, true);
    try {
      const res = await fetch(`/api/me/payment-methods/${id}/default`, {
        method: "POST",
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        showToast(data.error ?? "Wijzigen mislukt");
        return;
      }
      setMethods((prev) => {
        if (!prev) return prev;
        const next = prev
          .map((m) => ({ ...m, isDefault: m.id === id }))
          .sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
        writeCache(next);
        return next;
      });
      showToast("Standaardkaart bijgewerkt");
    } catch {
      showToast("Netwerkfout");
    } finally {
      setBusy(id, false);
    }
  }

  async function handleDelete(id: string) {
    setBusy(id, true);
    try {
      const res = await fetch(`/api/me/payment-methods/${id}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        showToast(data.error ?? "Verwijderen mislukt");
        return;
      }
      setMethods((prev) => {
        if (!prev) return prev;
        const remaining = prev.filter((m) => m.id !== id);
        // If we removed the default, locally promote the most-recent remaining card
        // to mirror the server's promote-on-delete behaviour.
        if (
          prev.find((m) => m.id === id)?.isDefault &&
          remaining.length > 0 &&
          !remaining.some((m) => m.isDefault)
        ) {
          remaining[0] = { ...remaining[0], isDefault: true };
        }
        writeCache(remaining);
        return remaining;
      });
      showToast("Kaart verwijderd");
    } catch {
      showToast("Netwerkfout");
    } finally {
      setBusy(id, false);
      setConfirmDeleteId(null);
    }
  }

  const list = methods ?? [];

  return (
    <div className="min-h-full bg-canvas pb-8">
      <StatusBarMock />

      <header className="flex items-center gap-3 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))]">
        <Link
          href="/me"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/[0.05] transition active:scale-95"
          aria-label="Terug naar profiel"
        >
          <ChevronLeft className="h-5 w-5 text-ink" strokeWidth={2.25} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[22px] font-bold leading-tight tracking-tight text-ink">
            Betaalmethoden
          </h1>
          <p className="text-[12px] text-gray-500">
            Beheer je opgeslagen kaarten
          </p>
        </div>
      </header>

      <div className="space-y-3 px-5 pt-2">
        {methods === null ? (
          <div className="space-y-2">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-[68px] animate-pulse rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04]"
              />
            ))}
          </div>
        ) : list.length === 0 ? (
          <div className="rounded-2xl bg-white p-7 text-center shadow-sm ring-1 ring-black/[0.04]">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#F4EFFF] text-[#7C5CFF]">
              <CreditCard className="h-6 w-6" strokeWidth={2.25} aria-hidden />
            </div>
            <p className="text-[15px] font-bold text-ink">
              Nog geen betaalmethode
            </p>
            <p className="mx-auto mt-1.5 max-w-[260px] text-[12.5px] leading-relaxed text-gray-500">
              Voeg een kaart toe om je credits sneller op te kunnen waarderen.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04]">
            {list.map((m, i) => (
              <div
                key={m.id}
                className={i > 0 ? "border-t border-gray-100" : ""}
              >
                <PaymentMethodRow
                  method={m}
                  busy={busyIds.has(m.id)}
                  onSetDefault={handleSetDefault}
                  onDelete={(id) => setConfirmDeleteId(id)}
                />
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 bg-white/70 text-[14px] font-bold text-[#7C5CFF] transition active:scale-[0.99]"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden />
          Kaart toevoegen
        </button>

        <p className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-gray-500">
          <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
          Veilig betalen — wij slaan alleen je kaartmerk en laatste 4 cijfers op.
        </p>
      </div>

      {/* Add card sheet */}
      <AnimatePresence>
        {adding && (
          <AddCardSheet
            onClose={() => setAdding(false)}
            forceDefault={list.length === 0}
            onAdded={(m) => {
              setMethods((prev) => {
                const base = prev ?? [];
                // Server may have demoted an existing default — recompute.
                const updated = m.isDefault
                  ? base.map((x) => ({ ...x, isDefault: false }))
                  : base;
                const next = [m, ...updated].sort(
                  (a, b) => Number(b.isDefault) - Number(a.isDefault),
                );
                writeCache(next);
                return next;
              });
              setAdding(false);
              showToast("Kaart toegevoegd");
            }}
          />
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <AnimatePresence>
        {confirmDeleteId && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[280] bg-black/40"
              onClick={() => setConfirmDeleteId(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.16 }}
              className="fixed left-1/2 top-1/2 z-[290] w-[min(92vw,360px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white p-5 shadow-2xl"
            >
              <p className="text-center text-[16px] font-bold text-ink">
                Kaart verwijderen?
              </p>
              <p className="mt-1.5 text-center text-[12.5px] text-gray-500">
                Je kunt hem altijd opnieuw toevoegen.
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(null)}
                  className="h-11 flex-1 rounded-2xl bg-gray-100 text-[13px] font-bold text-ink transition active:scale-[0.98]"
                >
                  Annuleer
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(confirmDeleteId)}
                  disabled={busyIds.has(confirmDeleteId)}
                  className="h-11 flex-1 rounded-2xl bg-red-500 text-[13px] font-bold text-white transition active:scale-[0.98] disabled:opacity-60"
                >
                  Verwijder
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="pointer-events-none fixed bottom-24 left-1/2 z-[400] max-w-[min(90vw,360px)] -translate-x-1/2 rounded-full bg-ink/95 px-5 py-3 text-center text-[13px] font-semibold text-white shadow-lg backdrop-blur-sm"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
