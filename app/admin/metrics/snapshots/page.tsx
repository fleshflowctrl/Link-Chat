import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { AdminPageHeader } from "@/components/admin/page-header";
import { SnapshotsListView } from "@/components/admin/snapshots-list-view";
import {
  listMetricsSnapshots,
  type AdminMetricsSnapshot,
} from "@/lib/admin/metrics-snapshots";

export const dynamic = "force-dynamic";

export default async function AdminSnapshotsPage() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.status === 401) redirect("/login?next=/admin/metrics/snapshots");
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
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        SUPABASE_SERVICE_ROLE_KEY ontbreekt — voeg hem toe aan je env.
      </div>
    );
  }

  let snapshots: AdminMetricsSnapshot[] = [];
  let loadError: string | null = null;
  try {
    snapshots = await listMetricsSnapshots(service);
  } catch (e) {
    snapshots = [];
    loadError = e instanceof Error ? e.message : "Laden mislukt";
  }

  return (
    <div className="mx-auto max-w-7xl">
      <AdminPageHeader
        crumbs={[
          { label: "Admin" },
          { label: "Statistieken", href: "/admin/metrics" },
          { label: "Snapshots" },
        ]}
        title="Snapshots"
        description="Bewaarde resetmomenten — bekijk een snapshot of vergelijk er twee."
      />

      {loadError ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {loadError}
        </div>
      ) : null}

      <SnapshotsListView snapshots={snapshots} />
    </div>
  );
}
