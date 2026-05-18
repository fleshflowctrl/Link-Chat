import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { AdminPageHeader } from "@/components/admin/page-header";
import { MetricsVariantCompare } from "@/components/admin/metrics-variant-compare";
import { loadAdminMetrics } from "@/lib/admin/metrics";
import { getMetricsSince } from "@/lib/admin/metrics-settings";

export const dynamic = "force-dynamic";

export default async function AdminMetricsComparePage() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.status === 401) redirect("/login?next=/admin/metrics/vergelijk");
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
        <h1 className="text-lg font-semibold">Geen toegang</h1>
        <p className="mt-1 text-sm">{auth.error}</p>
      </div>
    );
  }

  const service = getServiceSupabase();
  if (!service) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        SUPABASE_SERVICE_ROLE_KEY ontbreekt.
      </div>
    );
  }

  const [sinceV1, sinceV2] = await Promise.all([
    getMetricsSince(service, "v1"),
    getMetricsSince(service, "v2"),
  ]);

  const [v1, v2] = await Promise.all([
    loadAdminMetrics(service, { since: sinceV1, variant: "v1" }),
    loadAdminMetrics(service, { since: sinceV2, variant: "v2" }),
  ]);

  return (
    <div className="mx-auto max-w-7xl">
      <AdminPageHeader
        crumbs={[
          { label: "Admin" },
          { label: "Statistieken" },
          { label: "V1 vs V2" },
        ]}
        title="V1 vs V2 vergelijking"
        description="Live metrics per variant (respecteert de reset-timestamp van elke variant)."
      />
      <MetricsVariantCompare v1={v1} v2={v2} />
    </div>
  );
}
