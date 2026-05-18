import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { AdminPageHeader } from "@/components/admin/page-header";
import { MetricsDashboard } from "@/components/admin/metrics-dashboard";
import { getMetricsSnapshot } from "@/lib/admin/metrics-snapshots";

export const dynamic = "force-dynamic";

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

export default async function AdminSnapshotDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.status === 401) {
      redirect(`/login?next=/admin/metrics/snapshots/${params.id}`);
    }
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
        SUPABASE_SERVICE_ROLE_KEY ontbreekt.
      </div>
    );
  }

  const snapshot = await getMetricsSnapshot(service, params.id);
  if (!snapshot) notFound();

  return (
    <div className="mx-auto max-w-7xl">
      <AdminPageHeader
        crumbs={[
          { label: "Admin" },
          { label: "Statistieken", href: "/admin/metrics" },
          { label: "Snapshots", href: "/admin/metrics/snapshots" },
          { label: snapshot.label ?? formatTs(snapshot.takenAt) },
        ]}
        title={snapshot.label ?? `Snapshot ${formatTs(snapshot.takenAt)}`}
        description={
          <>
            Periode:{" "}
            <span className="font-medium text-gray-900">
              {formatTs(snapshot.periodStart)}
            </span>{" "}
            →{" "}
            <span className="font-medium text-gray-900">
              {formatTs(snapshot.periodEnd)}
            </span>
          </>
        }
        actions={
          <Link
            href="/admin/metrics/snapshots"
            className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            ← Terug
          </Link>
        }
      />

      <MetricsDashboard metrics={snapshot.metrics} />
    </div>
  );
}
