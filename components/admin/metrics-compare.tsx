import type { AdminMetrics } from "@/lib/admin/metrics";
import type { AdminMetricsSnapshot } from "@/lib/admin/metrics-snapshots";

function nf(n: number, digits = 0): string {
  return n.toLocaleString("nl-NL", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function euro(cents: number): string {
  return `€ ${(cents / 100).toLocaleString("nl-NL", {
    minimumFractionDigits: digits(cents),
    maximumFractionDigits: digits(cents),
  })}`;
}

function digits(cents: number): number {
  return cents % 100 === 0 ? 0 : 2;
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

type Row = {
  label: string;
  get: (m: AdminMetrics) => number;
  digits?: number;
  format?: (n: number) => string;
  higherBetter?: boolean;
};

const ROWS: Array<Row | "group" | string> = [
  "Kern",
  { label: "Users", get: (m) => m.users },
  { label: "Gesprekken", get: (m) => m.conversations },
  { label: "Open chats", get: (m) => m.openChats },
  { label: "Aankopen", get: (m) => m.purchases },
  {
    label: "Omzet totaal",
    get: (m) => m.revenueCents,
    format: (n) => euro(n),
  },
  {
    label: "Credits verkocht",
    get: (m) => m.creditsSold,
  },
  "Berichten (7d)",
  { label: "Profiel", get: (m) => m.messagesProfile7d },
  { label: "Users", get: (m) => m.messagesUsers7d },
  { label: "Totaal", get: (m) => m.messagesTotal7d },
];

function deltaTone(
  a: number,
  b: number,
  higherBetter = true,
): "good" | "bad" | "flat" {
  if (a === b) return "flat";
  const isGood = higherBetter ? b > a : b < a;
  return isGood ? "good" : "bad";
}

function formatDelta(a: number, b: number, digits = 0): string {
  const diff = b - a;
  const sign = diff > 0 ? "+" : "";
  if (a === 0 && b === 0) return "—";
  const absStr = `${sign}${nf(diff, digits)}`;
  if (a === 0) return absStr;
  const pct = (diff / Math.abs(a)) * 100;
  const pctStr = `${diff > 0 ? "+" : ""}${pct.toLocaleString("nl-NL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
  return `${absStr} (${pctStr})`;
}

export function MetricsCompare({
  a,
  b,
}: {
  a: AdminMetricsSnapshot;
  b: AdminMetricsSnapshot;
}) {
  const labelA = a.label ?? formatTs(a.takenAt);
  const labelB = b.label ?? formatTs(b.takenAt);

  return (
    <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
      <div className="hidden grid-cols-[1.4fr_repeat(3,_1fr)] gap-0 border-b border-black/5 bg-gray-50/80 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 sm:grid">
        <div>Metric</div>
        <div className="truncate" title={labelA}>
          A · {labelA}
        </div>
        <div>Δ</div>
        <div className="truncate" title={labelB}>
          B · {labelB}
        </div>
      </div>

      <div>
        {ROWS.map((row, i) => {
          if (typeof row === "string") {
            return (
              <div
                key={`group-${i}`}
                className="border-t border-black/[0.04] bg-gradient-to-b from-gray-50/60 to-white px-4 pt-4 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500 sm:px-5"
              >
                {row}
              </div>
            );
          }
          const va = row.get(a.metrics);
          const vb = row.get(b.metrics);
          const tone = deltaTone(va, vb, row.higherBetter ?? true);
          const toneClass =
            tone === "good"
              ? "text-emerald-700"
              : tone === "bad"
                ? "text-red-700"
                : "text-gray-400";
          const fmt = row.format ?? ((n: number) => nf(n, row.digits ?? 0));

          return (
            <div
              key={row.label}
              className="border-t border-black/[0.04] px-4 py-3 text-sm sm:grid sm:grid-cols-[1.4fr_repeat(3,_1fr)] sm:items-baseline sm:gap-0 sm:px-5 sm:py-2.5"
            >
              <div className="text-gray-700">{row.label}</div>
              <div className="mt-1 font-semibold tabular-nums text-gray-900 sm:mt-0">
                {fmt(va)}
              </div>
              <div className={`font-medium tabular-nums ${toneClass}`}>
                {formatDelta(va, vb, row.digits ?? 0)}
              </div>
              <div className="font-semibold tabular-nums text-gray-900">
                {fmt(vb)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
