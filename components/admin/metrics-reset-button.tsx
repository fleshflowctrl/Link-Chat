"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";

import type { AppVariant } from "@/lib/app-variant";

type Props = {
  /** Current cutoff so we can render "laatst gereset op …". */
  metricsSince: string | null;
  variant?: AppVariant;
};

function formatTs(iso: string): string {
  try {
    return new Date(iso).toLocaleString("nl-NL", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

/**
 * Password-gated button that resets the "live" metrics view. The actual
 * password check happens server-side in /api/admin/metrics/reset; this
 * component only collects input and triggers the request.
 */
export function MetricsResetButton({
  metricsSince,
  variant = "v1",
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
    setPassword("");
    setLabel("");
    setError(null);
  }, []);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/metrics/reset", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ password, label, variant }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
        };
        if (!res.ok || !json.ok) {
          setError(json.error ?? "Resetten mislukt");
          return;
        }
        close();
        startTransition(() => {
          router.refresh();
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Resetten mislukt");
      } finally {
        setSubmitting(false);
      }
    },
    [close, label, password, variant, router],
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
        >
          <RotateCcw className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
          Reset statistieken
        </button>

        {metricsSince ? (
          <span className="text-[11px] text-gray-500">
            Laatste reset: {formatTs(metricsSince)}
          </span>
        ) : null}
      </div>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 px-4"
          onClick={close}
        >
          <form
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h3 className="text-base font-semibold text-gray-900">
              Statistieken resetten
            </h3>
            <p className="mt-1 text-xs text-gray-600">
              De huidige cijfers worden opgeslagen als{" "}
              <span className="font-semibold text-gray-900">snapshot</span> en
              de live-pagina begint vanaf 0. Bestaande data blijft staan
              (zichtbaar op{" "}
              <span className="font-semibold text-gray-900">/admin/metrics/totaal</span>).
            </p>

            <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-gray-500">
              Snapshot-label (optioneel)
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="bv. 'Voor TikTok-campagne'"
              maxLength={120}
              autoComplete="off"
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />

            <label className="mt-3 block text-xs font-semibold uppercase tracking-wider text-gray-500">
              Wachtwoord
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              autoComplete="off"
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />

            {error ? (
              <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                {error}
              </p>
            ) : null}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={close}
                className="rounded-full px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100"
              >
                Annuleren
              </button>
              <button
                type="submit"
                disabled={submitting || pending || !password.trim()}
                className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60"
              >
                {submitting || pending ? "Resetten…" : "Bevestig reset"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
