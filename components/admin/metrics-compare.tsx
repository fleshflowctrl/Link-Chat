import type { AdminMetrics } from "@/lib/admin/metrics";
import type { AdminMetricsSnapshot } from "@/lib/admin/metrics-snapshots";

function nf(n: number, digits = 0): string {
  return n.toLocaleString("nl-NL", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
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
  /** Higher is better (true) or lower is better (false) for delta coloring. */
  higherBetter?: boolean;
};

const ROWS: Array<Row | "group" | string> = [
  "Bereik",
  { label: "Website bezoekers", get: (m) => m.visitors },
  { label: "Sign-ups", get: (m) => m.signups },
  { label: "Chattende users", get: (m) => m.chatters },
  { label: "Berichten verstuurd", get: (m) => m.totalUserMessages },
  { label: "Berichten per sign-up", get: (m) => m.avgMessagesPerSignup, digits: 1 },

  "Betalingen",
  { label: "Betalende klanten", get: (m) => m.payingUsers },
  { label: "Unieke betaal-klikkers", get: (m) => m.checkoutClickers },
  { label: "Totale Betaal-kliks", get: (m) => m.checkoutClicks },
  { label: "Voltooide aankopen", get: (m) => m.paidPurchases },

  "Credits",
  { label: "Credits gebruikt totaal", get: (m) => m.creditsSpentTotal },
  { label: "Gem. credits per sign-up", get: (m) => m.avgCreditsSpentPerSignup },
  { label: "Gem. credits per chatter", get: (m) => m.avgCreditsSpentPerChatter },

  "Visitor → conversie",
  { label: "Bezoeker → sign-up", get: (m) => m.visitorsConvertedToSignup },
  { label: "Bezoeker → chat", get: (m) => m.visitorsConvertedToChat },

  "Retentie",
  {
    label: "D1 retentie",
    get: (m) => {
      const r = m.retention.find((x) => x.days === 1);
      if (!r || r.eligible === 0) return 0;
      return (r.retained / r.eligible) * 100;
    },
    digits: 1,
  },
  {
    label: "D7 retentie",
    get: (m) => {
      const r = m.retention.find((x) => x.days === 7);
      if (!r || r.eligible === 0) return 0;
      return (r.retained / r.eligible) * 100;
    },
    digits: 1,
  },
  {
    label: "D30 retentie",
    get: (m) => {
      const r = m.retention.find((x) => x.days === 30);
      if (!r || r.eligible === 0) return 0;
      return (r.retained / r.eligible) * 100;
    },
    digits: 1,
  },
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
  return (
    <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
      <div className="grid grid-cols-[1.4fr_repeat(3,_1fr)] gap-0 border-b border-black/5 bg-gray-50/80 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        <div>Metric</div>
        <div className="truncate" title={a.label ?? ""}>
          A · {a.label ?? formatTs(a.takenAt)}
        </div>
        <div>Δ</div>
        <div className="truncate" title={b.label ?? ""}>
          B · {b.label ?? formatTs(b.takenAt)}
        </div>
      </div>

      <div>
        {ROWS.map((row, i) => {
          if (typeof row === "string") {
            return (
              <div
                key={`group-${i}`}
                className="border-t border-black/[0.04] bg-gradient-to-b from-gray-50/60 to-white px-5 pt-4 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-500"
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
          return (
            <div
              key={row.label}
              className="grid grid-cols-[1.4fr_repeat(3,_1fr)] items-baseline gap-0 border-t border-black/[0.04] px-5 py-2.5 text-sm"
            >
              <div className="text-gray-700">{row.label}</div>
              <div className="font-semibold tabular-nums text-gray-900">
                {nf(va, row.digits ?? 0)}
              </div>
              <div className={`font-medium tabular-nums ${toneClass}`}>
                {formatDelta(va, vb, row.digits ?? 0)}
              </div>
              <div className="font-semibold tabular-nums text-gray-900">
                {nf(vb, row.digits ?? 0)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
