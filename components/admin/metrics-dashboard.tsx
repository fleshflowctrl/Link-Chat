import type { AdminMetrics } from "@/lib/admin/metrics";
import { MetricsPeriodTable } from "@/components/admin/metrics-period-table";

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

function pctLabel(p: number): string {
  if (!Number.isFinite(p) || p <= 0) return "0%";
  return `${Math.round(p)}%`;
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warn";
}) {
  const toneClass =
    tone === "warn"
      ? "border-amber-300/70 bg-gradient-to-br from-amber-50 to-white"
      : "border-black/5 bg-white";

  return (
    <div
      className={`flex min-h-[88px] flex-col justify-center rounded-xl border px-4 py-3 shadow-sm ${toneClass}`}
    >
      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <span className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-gray-900">
        {value}
      </span>
    </div>
  );
}

type MetricsDashboardProps = {
  metrics: AdminMetrics;
  variant?: string;
};

export function MetricsDashboard({ metrics, variant }: MetricsDashboardProps) {
  return (
    <>
      <section className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
        <StatCard label="Website visits" value={nf(metrics.visitors)} />
        <StatCard label="Users" value={nf(metrics.users)} />
        <StatCard label="Gesprekken" value={nf(metrics.conversations)} />
        <StatCard label="Open chats" value={nf(metrics.openChats)} tone="warn" />
        <StatCard label="Aankopen" value={nf(metrics.purchases)} />
        <StatCard label="Omzet totaal" value={euro(metrics.revenueCents)} />
        <StatCard
          label="Avg revenue / user"
          value={euro(metrics.avgRevenuePerUserCents)}
        />
        <StatCard
          label="Avg. LTV paying user"
          value={euro(metrics.avgLtvPayingUserCents)}
        />
        <StatCard label="Credits verkocht" value={nf(metrics.creditsSold)} />
      </section>

      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Signup mobile" value={pctLabel(metrics.signupMobilePct)} />
        <StatCard label="Signup desktop" value={pctLabel(metrics.signupDesktopPct)} />
        <StatCard
          label="Berichten profiel (7d)"
          value={nf(metrics.messagesProfile7d)}
        />
        <StatCard
          label="Berichten users (7d)"
          value={nf(metrics.messagesUsers7d)}
        />
        <StatCard
          label="Berichten totaal (7d)"
          value={nf(metrics.messagesTotal7d)}
        />
      </section>

      <MetricsPeriodTable
        months={metrics.periodMonths}
        totals={{
          revenueCents: metrics.revenueCents,
          users: metrics.users,
          purchases: metrics.purchases,
        }}
        variant={variant}
        since={metrics.metricsSince}
      />
    </>
  );
}
