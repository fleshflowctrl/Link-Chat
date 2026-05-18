import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { AdminPageHeader } from "@/components/admin/page-header";
import { MetricsCompare } from "@/components/admin/metrics-compare";
import { getMetricsSnapshotsByIds } from "@/lib/admin/metrics-snapshots";

export const dynamic = "force-dynamic";

export default async function AdminSnapshotsComparePage({
  searchParams,
}: {
  searchParams: { a?: string; b?: string };
}) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.status === 401) {
      redirect("/login?next=/admin/metrics/snapshots");
    }
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
        <h1 className="text-lg font-semibold">Geen toegang</h1>
        <p className="mt-1 text-sm">{auth.error}</p>
      </div>
    );
  }

  const a = searchParams.a?.trim();
  const b = searchParams.b?.trim();
  if (!a || !b || a === b) {
    return (
      <div className="mx-auto max-w-3xl">
        <AdminPageHeader
          crumbs={[
            { label: "Admin" },
            { label: "Statistieken", href: "/admin/metrics" },
            { label: "Snapshots", href: "/admin/metrics/snapshots" },
            { label: "Vergelijken" },
          ]}
          title="Twee snapshots kiezen"
          description="Selecteer twee verschillende snapshots in de lijst om te vergelijken."
        />
        <Link
          href="/admin/metrics/snapshots"
          className="inline-flex rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-white shadow-sm"
        >
          ← Naar snapshot-lijst
        </Link>
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

  const rows = await getMetricsSnapshotsByIds(service, [a, b]);
  const snapA = rows.find((r) => r.id === a);
  const snapB = rows.find((r) => r.id === b);
  if (!snapA || !snapB) {
    return (
      <div className="mx-auto max-w-3xl">
        <AdminPageHeader
          crumbs={[
            { label: "Admin" },
            { label: "Statistieken", href: "/admin/metrics" },
            { label: "Snapshots", href: "/admin/metrics/snapshots" },
            { label: "Vergelijken" },
          ]}
          title="Snapshot niet gevonden"
        />
        <Link
          href="/admin/metrics/snapshots"
          className="inline-flex rounded-full bg-primary px-3 py-1.5 text-sm font-semibold text-white shadow-sm"
        >
          ← Naar snapshot-lijst
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        crumbs={[
          { label: "Admin" },
          { label: "Statistieken", href: "/admin/metrics" },
          { label: "Snapshots", href: "/admin/metrics/snapshots" },
          { label: "Vergelijken" },
        ]}
        title="Snapshots vergelijken"
        description="Δ = verschil van A → B. Groen = beter, rood = slechter."
        actions={
          <Link
            href="/admin/metrics/snapshots"
            className="rounded-full border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            ← Terug
          </Link>
        }
      />

      <MetricsCompare a={snapA} b={snapB} />
    </div>
  );
}
