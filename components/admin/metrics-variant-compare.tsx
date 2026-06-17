import type { AdminMetrics } from "@/lib/admin/metrics";

function nf(n: number, digits = 0): string {
  return n.toLocaleString("nl-NL", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function euro(cents: number): string {
  return `€ ${(cents / 100).toLocaleString("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

type Row = {
  label: string;
  get: (m: AdminMetrics) => number;
  digits?: number;
  format?: (n: number) => string;
};

const ROWS: Array<Row | string> = [
  "Kern",
  { label: "Users", get: (m) => m.users },
  { label: "Gesprekken", get: (m) => m.conversations },
  { label: "Open chats", get: (m) => m.openChats },
  { label: "Aankopen", get: (m) => m.purchases },
  { label: "Omzet", get: (m) => m.revenueCents, format: euro },
  { label: "Credits verkocht", get: (m) => m.creditsSold },
];

function deltaClass(v1: number, v2: number): string {
  if (v1 === v2) return "text-gray-400";
  return v2 > v1 ? "text-emerald-700" : "text-red-700";
}

export function MetricsVariantCompare({
  v1,
  v2,
}: {
  v1: AdminMetrics;
  v2: AdminMetrics;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
      <div className="hidden grid-cols-[1.2fr_1fr_1fr_1fr] gap-0 border-b border-black/5 bg-gray-50/80 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500 sm:grid">
        <div>Metric</div>
        <div>V1</div>
        <div>V2</div>
        <div>Δ (v2 − v1)</div>
      </div>

      <div>
        {ROWS.map((row, i) => {
          if (typeof row === "string") {
            return (
              <div
                key={`g-${i}`}
                className="border-t border-black/[0.04] bg-gray-50/60 px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-500 sm:px-5"
              >
                {row}
              </div>
            );
          }
          const a = row.get(v1);
          const b = row.get(v2);
          const diff = b - a;
          const fmt = row.format ?? ((n: number) => nf(n, row.digits ?? 0));
          return (
            <div
              key={row.label}
              className="border-t border-black/[0.04] px-4 py-3 text-sm sm:grid sm:grid-cols-[1.2fr_1fr_1fr_1fr] sm:items-baseline sm:gap-2 sm:px-5"
            >
              <div className="text-gray-700">{row.label}</div>
              <div className="mt-1 font-semibold tabular-nums sm:mt-0">{fmt(a)}</div>
              <div className="font-semibold tabular-nums">{fmt(b)}</div>
              <div className={`font-medium tabular-nums ${deltaClass(a, b)}`}>
                {diff > 0 ? "+" : ""}
                {fmt(diff)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
