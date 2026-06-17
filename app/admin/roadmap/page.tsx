import { redirect } from "next/navigation";
import { FunnelPeriodTabs } from "@/components/admin/funnel-period-tabs";
import { FunnelResetButton } from "@/components/admin/funnel-reset-button";
import { FunnelRoadmap } from "@/components/admin/funnel-roadmap";
import { AdminPageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/lib/auth/require-admin";
import { loadFunnelRoadmapMetrics } from "@/lib/admin/funnel-roadmap";
import {
  funnelPeriodDescription,
  parseFunnelPeriod,
  resolveFunnelPeriodSince,
} from "@/lib/admin/funnel-period";
import { getFunnelSince } from "@/lib/admin/funnel-settings";
import { getServiceSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

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

export default async function AdminRoadmapPage({
  searchParams,
}: {
  searchParams?: { period?: string; scope?: string };
}) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.status === 401) redirect("/login?next=/admin/roadmap");
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
        <h1 className="text-lg font-semibold">Geen toegang</h1>
        <p className="mt-1 text-sm">{auth.error}</p>
      </div>
    );
  }

  const period = parseFunnelPeriod(
    searchParams?.period ?? (searchParams?.scope === "all" ? "all" : undefined),
  );
  const service = getServiceSupabase();
  if (!service) {
    return (
      <div className="mx-auto max-w-4xl rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        SUPABASE_SERVICE_ROLE_KEY ontbreekt — voeg hem toe aan je env.
      </div>
    );
  }

  const liveSince = await getFunnelSince(service);
  const metricsSince = resolveFunnelPeriodSince(period, liveSince);

  let data;
  try {
    data = await loadFunnelRoadmapMetrics(service, {
      since: metricsSince,
      variant: "v2",
    });
  } catch (e) {
    return (
      <div className="mx-auto max-w-4xl rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        {e instanceof Error ? e.message : "Kon funnel niet laden"}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <AdminPageHeader
        crumbs={[{ label: "Admin" }, { label: "Funnel roadmap" }]}
        title="Funnel roadmap"
        description={funnelPeriodDescription(period, metricsSince, formatTs)}
        actions={
          <>
            <FunnelPeriodTabs active={period} />
            <FunnelResetButton funnelSince={liveSince} />
          </>
        }
      />

      <p className="mb-4 text-[13px] leading-snug text-zinc-400">
        Elke stap telt unieke bezoekers of accounts. &quot;70 gratis credits
        opgebruikt&quot; = minstens 7 verstuurde berichten (70 punten). Historische
        data vóór deze update mist klikken op de welkomstknop en
        registratiepagina-bezoeken.
      </p>

      <FunnelRoadmap data={data} />
    </div>
  );
}
