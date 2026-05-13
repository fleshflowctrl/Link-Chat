"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Coins, Gift, X } from "lucide-react";
import {
  applyServerCreditsUpdate,
  getCreditsSnapshot,
  subscribeCredits,
} from "@/lib/credits-store";

const PRESETS = [5, 10, 25, 50, 100, 250] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  peerName: string;
  peerAvatarUrl: string;
  /** Returns { ok: true, newBalance? } on success or { ok: false, error } on failure. */
  onSend: (
    amount: number,
  ) => Promise<{ ok: true; newBalance?: number } | { ok: false; error: string }>;
};

export function GiftModal({
  open,
  onClose,
  peerName,
  peerAvatarUrl,
  onSend,
}: Props) {
  const credits = useSyncExternalStore(
    subscribeCredits,
    getCreditsSnapshot,
    getCreditsSnapshot,
  ).balance;

  const [amount, setAmount] = useState<number>(PRESETS[1]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setSubmitting(false);
      setAmount(PRESETS[1]);
    }
  }, [open]);

  const insufficient = amount > credits;

  async function handleSend() {
    if (submitting || insufficient) return;
    setSubmitting(true);
    setError(null);
    const res = await onSend(amount);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (typeof res.newBalance === "number") {
      applyServerCreditsUpdate(res.newBalance);
    }
    onClose();
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative w-full max-w-[430px] overflow-hidden rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="Sluiten"
              onClick={onClose}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
            >
              <X className="h-5 w-5" strokeWidth={2.25} />
            </button>

            <div className="flex items-center gap-3">
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full bg-gray-100">
                {peerAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={peerAvatarUrl}
                    alt={peerName}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>
              <div>
                <h2 className="flex items-center gap-1.5 text-base font-bold tracking-tight text-ink">
                  <Gift className="h-4 w-4 text-primary" strokeWidth={2.25} />
                  Cadeau voor {peerName}
                </h2>
                <p className="text-xs text-gray-500">
                  Geef credits weg om {peerName} blij te maken.
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-2xl bg-gray-50 px-3 py-2.5 text-sm">
              <span className="text-gray-600">Jouw saldo</span>
              <span className="flex items-center gap-1 font-semibold text-ink">
                <Coins className="h-4 w-4 text-amber-500" strokeWidth={2.25} />
                {credits}
              </span>
            </div>

            <p className="mt-4 text-xs font-bold uppercase tracking-wider text-gray-500">
              Kies een bedrag
            </p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {PRESETS.map((p) => {
                const selected = amount === p;
                const tooExpensive = p > credits;
                return (
                  <button
                    key={p}
                    type="button"
                    disabled={tooExpensive}
                    onClick={() => setAmount(p)}
                    className={`flex flex-col items-center justify-center rounded-2xl border px-2 py-3 text-sm font-bold transition ${
                      selected
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : tooExpensive
                          ? "border-gray-200 bg-gray-50 text-gray-300"
                          : "border-gray-200 bg-white text-ink hover:border-primary/40"
                    }`}
                  >
                    <span className="flex items-center gap-1 text-base">
                      <Coins
                        className={`h-3.5 w-3.5 ${
                          selected ? "text-primary" : "text-amber-500"
                        }`}
                        strokeWidth={2.25}
                      />
                      {p}
                    </span>
                    <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-gray-400">
                      credits
                    </span>
                  </button>
                );
              })}
            </div>

            {error && (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                {error}
              </p>
            )}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-2xl border border-gray-200 bg-white py-3 text-sm font-bold text-gray-700 transition active:scale-[0.98]"
              >
                Annuleren
              </button>
              <button
                type="button"
                onClick={() => void handleSend()}
                disabled={submitting || insufficient}
                className="flex flex-[1.4] items-center justify-center gap-1.5 rounded-2xl bg-gradient-primary py-3 text-sm font-bold text-white shadow-md transition active:scale-[0.98] disabled:opacity-50"
              >
                {submitting ? (
                  "Versturen…"
                ) : insufficient ? (
                  "Te weinig credits"
                ) : (
                  <>
                    <Gift className="h-4 w-4" strokeWidth={2.25} />
                    Verstuur {amount} credits
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
