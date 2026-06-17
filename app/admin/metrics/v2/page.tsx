import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { AdminPageHeader } from "@/components/admin/page-header";
import { MetricsDashboard } from "@/components/admin/metrics-dashboard";
import { MetricsResetButton } from "@/components/admin/metrics-reset-button";
import { loadAdminMetrics, type AdminMetrics } from "@/lib/admin/metrics";
import { getMetricsSince } from "@/lib/admin/metrics-settings";

export const dynamic = "force-dynamic";

async function loadMetrics(): Promise<
  | { ok: true; metrics: AdminMetrics; metricsSince: string | null }
  | { ok: false; error: string }
> {
  const service = getServiceSupabase();
  if (!service) {
    return {
      ok: false,
      error: "SUPABASE_SERVICE_ROLE_KEY ontbreekt — voeg hem toe aan je env.",
    };
  }
  try {
    const metricsSince = await getMetricsSince(service, "v2");
    const metrics = await loadAdminMetrics(service, {
      since: metricsSince,
      variant: "v2",
    });
    return { ok: true, metrics, metricsSince };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Onbekende fout",
    };
  }
}

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

export default async function AdminMetricsV2Page() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.status === 401) redirect("/login?next=/admin/metrics/v2");
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
        <h1 className="text-lg font-semibold">Geen toegang</h1>
        <p className="mt-1 text-sm">{auth.error}</p>
      </div>
    );
  }

  const res = await loadMetrics();
  const metricsSince = res.ok ? res.metricsSince : null;

  return (
    <div className="mx-auto max-w-7xl">
      <AdminPageHeader
        crumbs={[
          { label: "Admin" },
          { label: "Statistieken" },
          { label: "V2 (live)" },
        ]}
        title="Statistieken V2 (live)"
        description={
          metricsSince
            ? `Telt vanaf ${formatTs(metricsSince)}. Alleen /v2-traffic en v2-users.`
            : "Live metrics voor variant V2 — nog nooit gereset."
        }
        actions={
          <MetricsResetButton metricsSince={metricsSince} variant="v2" />
        }
      />

      {!res.ok ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {res.error}
        </div>
      ) : (
        <MetricsDashboard metrics={res.metrics} variant="v2" />
      )}
    </div>
  );
}
