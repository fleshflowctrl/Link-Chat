"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GitCompareArrows } from "lucide-react";
import type { AdminMetricsSnapshot } from "@/lib/admin/metrics-snapshots";

function nf(n: number): string {
  return n.toLocaleString("nl-NL");
}

function formatTs(iso: string | null): string {
  if (!iso) return "begin";
  try {
    return new Date(iso).toLocaleString("nl-NL", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function SnapshotsListView({
  snapshots,
}: {
  snapshots: AdminMetricsSnapshot[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);

  const sortedSelected = useMemo(() => {
    // Keep insertion order so the user sees A vs B in the order picked.
    return selected;
  }, [selected]);

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }

  function goCompare() {
    if (sortedSelected.length !== 2) return;
    router.push(
      `/admin/metrics/snapshots/compare?a=${sortedSelected[0]}&b=${sortedSelected[1]}`,
    );
  }

  if (snapshots.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
        <p className="text-sm font-semibold text-gray-700">
          Nog geen snapshots
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Druk op{" "}
          <Link
            href="/admin/metrics"
            className="font-medium text-primary hover:underline"
          >
            Statistieken (live)
          </Link>{" "}
          → Reset statistieken om er één te maken.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="sticky top-0 z-10 -mx-2 mb-3 flex items-center justify-between gap-3 rounded-2xl bg-white/95 px-3 py-2.5 shadow-sm ring-1 ring-black/5 backdrop-blur-sm">
        <p className="text-xs font-medium text-gray-600">
          {sortedSelected.length === 0 && "Selecteer 2 snapshots om te vergelijken"}
          {sortedSelected.length === 1 && "Selecteer er nog 1"}
          {sortedSelected.length === 2 && "Klaar om te vergelijken"}
        </p>
        <button
          type="button"
          onClick={goCompare}
          disabled={sortedSelected.length !== 2}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition disabled:opacity-50"
        >
          <GitCompareArrows className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
          Vergelijken
        </button>
      </div>

      <ul className="divide-y divide-black/5 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
        {snapshots.map((s) => {
          const m = s.metrics;
          const checked = selected.includes(s.id);
          return (
            <li key={s.id}>
              <div className="flex items-start gap-4 px-5 py-4">
                <label className="mt-0.5 inline-flex shrink-0 cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(s.id)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                </label>
                <Link
                  href={`/admin/metrics/snapshots/${s.id}`}
                  className="min-w-0 flex-1"
                >
                  <p className="truncate text-sm font-semibold text-gray-900">
                    {s.label ?? `Snapshot ${formatTs(s.takenAt)}`}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    Periode: {formatTs(s.periodStart)} → {formatTs(s.periodEnd)}
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px] sm:grid-cols-3 lg:grid-cols-5">
                    <Stat label="Bezoekers" value={nf(m.visitors)} />
                    <Stat label="Sign-ups" value={nf(m.signups)} />
                    <Stat label="Chatters" value={nf(m.chatters)} />
                    <Stat label="Betalend" value={nf(m.payingUsers)} />
                    <Stat label="Aankopen" value={nf(m.paidPurchases)} />
                  </div>
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5">
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </span>
      <span className="truncate font-semibold tabular-nums text-gray-900">
        {value}
      </span>
    </div>
  );
}
