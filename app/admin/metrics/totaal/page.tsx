import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { AdminPageHeader } from "@/components/admin/page-header";
import { MetricsDashboard } from "@/components/admin/metrics-dashboard";
import { loadAdminMetrics, type AdminMetrics } from "@/lib/admin/metrics";
import { getMetricsSince } from "@/lib/admin/metrics-settings";

export const dynamic = "force-dynamic";

async function loadMetrics(): Promise<
  | { ok: true; metrics: AdminMetrics; liveSince: string | null }
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
    // Read the live cutoff just for context display; the all-time view
    // intentionally ignores it when loading metrics.
    const liveSince = await getMetricsSince(service);
    const metrics = await loadAdminMetrics(service, { since: null });
    return { ok: true, metrics, liveSince };
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

export default async function AdminMetricsTotalPage() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.status === 401) redirect("/login?next=/admin/metrics/totaal");
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
        <h1 className="text-lg font-semibold">Geen toegang</h1>
        <p className="mt-1 text-sm">{auth.error}</p>
      </div>
    );
  }

  const res = await loadMetrics();

  return (
    <div className="mx-auto max-w-7xl">
      <AdminPageHeader
        crumbs={[
          { label: "Admin" },
          { label: "Statistieken", href: "/admin/metrics" },
          { label: "Totaal" },
        ]}
        title="Statistieken (totaal)"
        description={
          res.ok && res.liveSince
            ? `Alle data sinds het begin. Live-view telt vanaf ${formatTs(res.liveSince)}.`
            : "Alle data sinds het begin — nooit gereset."
        }
      />

      {!res.ok ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {res.error}
        </div>
      ) : (
        <MetricsDashboard metrics={res.metrics} />
      )}
    </div>
  );
}
