import type { AdminMetrics } from "@/lib/admin/metrics";
import { pct } from "@/lib/admin/metrics";

function nf(n: number, digits = 0): string {
  return n.toLocaleString("nl-NL", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

type Row = {
  label: string;
  get: (m: AdminMetrics) => number;
  digits?: number;
  suffix?: string;
};

const ROWS: Array<Row | string> = [
  "Bereik",
  { label: "Website bezoekers", get: (m) => m.visitors },
  { label: "Sign-ups", get: (m) => m.signups },
  { label: "Chattende users", get: (m) => m.chatters },
  { label: "Berichten verstuurd", get: (m) => m.totalUserMessages },
  {
    label: "Berichten per sign-up",
    get: (m) => m.avgMessagesPerSignup,
    digits: 1,
  },
  "Betalingen",
  { label: "Betalende klanten", get: (m) => m.payingUsers },
  { label: "Unieke betaal-klikkers", get: (m) => m.checkoutClickers },
  { label: "Voltooide aankopen", get: (m) => m.paidPurchases },
  "Conversie",
  { label: "Bezoeker → sign-up", get: (m) => m.visitorsConvertedToSignup },
  { label: "Bezoeker → chat", get: (m) => m.visitorsConvertedToChat },
  {
    label: "Checkout → betaald %",
    get: (m) =>
      m.checkoutClickers > 0
        ? pct(m.paidPurchases, m.checkoutClickers)
        : 0,
    digits: 1,
    suffix: "%",
  },
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
          const suffix = row.suffix ?? "";
          return (
            <div
              key={row.label}
              className="border-t border-black/[0.04] px-4 py-3 text-sm sm:grid sm:grid-cols-[1.2fr_1fr_1fr_1fr] sm:items-baseline sm:gap-2 sm:px-5"
            >
              <div className="text-gray-700">{row.label}</div>
              <div className="mt-1 font-semibold tabular-nums sm:mt-0">
                <span className="text-[10px] font-semibold uppercase text-gray-400 sm:hidden">
                  V1{" "}
                </span>
                {nf(a, row.digits ?? 0)}
                {suffix}
              </div>
              <div className="font-semibold tabular-nums">
                <span className="text-[10px] font-semibold uppercase text-gray-400 sm:hidden">
                  V2{" "}
                </span>
                {nf(b, row.digits ?? 0)}
                {suffix}
              </div>
              <div className={`font-medium tabular-nums ${deltaClass(a, b)}`}>
                <span className="text-[10px] font-semibold uppercase text-gray-400 sm:hidden">
                  Δ{" "}
                </span>
                {diff > 0 ? "+" : ""}
                {nf(diff, row.digits ?? 0)}
                {suffix}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
