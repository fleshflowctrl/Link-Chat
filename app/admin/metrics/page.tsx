import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { AdminPageHeader } from "@/components/admin/page-header";
import { loadAdminMetrics, pct, type AdminMetrics } from "@/lib/admin/metrics";

export const dynamic = "force-dynamic";

function nf(n: number, digits = 0): string {
  return n.toLocaleString("nl-NL", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function pctLabel(p: number): string {
  if (!Number.isFinite(p) || p <= 0) return "0,0%";
  return `${p.toLocaleString("nl-NL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "primary" | "success" | "warn";
}) {
  const toneClass =
    tone === "primary"
      ? "from-primary/10 to-primary/0 border-primary/15"
      : tone === "success"
        ? "from-emerald-50 to-white border-emerald-200/60"
        : tone === "warn"
          ? "from-amber-50 to-white border-amber-200/60"
          : "from-white to-white border-black/5";

  return (
    <div
      className={`flex flex-col gap-1 rounded-2xl border bg-gradient-to-br ${toneClass} p-5 shadow-sm`}
    >
      <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </span>
      <span className="font-display text-3xl font-semibold tracking-tight text-gray-900">
        {value}
      </span>
      {hint ? (
        <span className="text-xs font-medium text-gray-500">{hint}</span>
      ) : null}
    </div>
  );
}

function FunnelRow({
  label,
  num,
  denom,
  hint,
}: {
  label: string;
  num: number;
  denom: number;
  hint?: string;
}) {
  const p = pct(num, denom);
  return (
    <li className="flex items-center gap-4 px-5 py-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        {hint ? (
          <p className="mt-0.5 text-xs text-gray-500">{hint}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <div className="hidden h-2 w-40 overflow-hidden rounded-full bg-gray-100 sm:block">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-pink-400"
            style={{ width: `${Math.min(100, p)}%` }}
          />
        </div>
        <div className="w-20 text-right text-sm font-semibold tabular-nums text-gray-900">
          {pctLabel(p)}
        </div>
        <div className="w-32 text-right text-xs tabular-nums text-gray-500">
          {nf(num)} / {nf(denom)}
        </div>
      </div>
    </li>
  );
}

async function loadMetrics(): Promise<
  | { ok: true; metrics: AdminMetrics }
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
    const metrics = await loadAdminMetrics(service);
    return { ok: true, metrics };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Onbekende fout",
    };
  }
}

export default async function AdminMetricsPage() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.status === 401) redirect("/login?next=/admin/metrics");
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
        crumbs={[{ label: "Admin" }, { label: "Statistieken" }]}
        title="Statistieken"
        description="Bezoekers, sign-ups, chat- en betaalconversie."
      />

      {!res.ok ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {res.error}
        </div>
      ) : (
        <>
          <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <StatCard
              label="Website bezoekers"
              value={nf(res.metrics.visitors)}
              hint={`${nf(res.metrics.visitorsLast7d)} laatste 7d · ${nf(res.metrics.visitorsLast30d)} laatste 30d`}
              tone="primary"
            />
            <StatCard
              label="Sign-ups"
              value={nf(res.metrics.signups)}
              hint={`${nf(res.metrics.signupsLast7d)} laatste 7d · ${nf(res.metrics.signupsLast30d)} laatste 30d`}
              tone="success"
            />
            <StatCard
              label="Chattende users"
              value={nf(res.metrics.chatters)}
              hint={`${nf(res.metrics.totalUserMessages)} berichten verstuurd`}
            />
            <StatCard
              label="Betalende klanten"
              value={nf(res.metrics.payingUsers)}
              hint="Minstens 1 credit-pack gekocht"
              tone="warn"
            />
            <StatCard
              label="Unieke betaal-klikkers"
              value={nf(res.metrics.checkoutClickers)}
              hint={`${nf(res.metrics.checkoutClicks)} totale kliks · ${nf(res.metrics.checkoutClicksLast7d)} laatste 7d`}
              tone="primary"
            />
            <StatCard
              label="Voltooide aankopen"
              value={nf(res.metrics.paidPurchases)}
              hint={`${nf(res.metrics.paidPurchasesLast7d)} laatste 7d · klik → koop ${pctLabel(pct(res.metrics.paidPurchases, res.metrics.checkoutClicks))}`}
              tone="success"
            />
            <StatCard
              label="Berichten per sign-up"
              value={nf(res.metrics.avgMessagesPerSignup, 1)}
              hint="Gemiddeld over alle accounts"
            />
            <StatCard
              label="Bezoekers → sign-up"
              value={nf(res.metrics.visitorsConvertedToSignup)}
              hint="Met visitor-cookie gekoppeld"
            />
            <StatCard
              label="Bezoekers → chat"
              value={nf(res.metrics.visitorsConvertedToChat)}
              hint="Bezoekers die ook chatten"
            />
          </section>

          <section className="mb-8 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
            <header className="border-b border-black/5 px-5 py-4">
              <h2 className="text-sm font-semibold tracking-tight text-gray-900">
                Conversie funnel
              </h2>
              <p className="mt-0.5 text-xs text-gray-500">
                Bezoeker → sign-up → eerste chat → betalende klant.
              </p>
            </header>
            <ul className="divide-y divide-black/5">
              <FunnelRow
                label="Bezoeker → sign-up"
                num={res.metrics.visitorsConvertedToSignup}
                denom={res.metrics.visitors}
                hint="Cookies sinds tracking aanstond"
              />
              <FunnelRow
                label="Bezoeker → chat"
                num={res.metrics.visitorsConvertedToChat}
                denom={res.metrics.visitors}
                hint="Visitor die ook chatte"
              />
              <FunnelRow
                label="Sign-up → chat"
                num={res.metrics.chatters}
                denom={res.metrics.signups}
                hint="Account met ≥1 verzonden bericht"
              />
              <FunnelRow
                label="Sign-up → betalende klant"
                num={res.metrics.payingUsers}
                denom={res.metrics.signups}
                hint="Account met ≥1 credit-pack aankoop"
              />
              <FunnelRow
                label="Sign-up → klikte op Betaal"
                num={res.metrics.checkoutClickers}
                denom={res.metrics.signups}
                hint="Unieke users die de Betaal-knop indrukten"
              />
              <FunnelRow
                label="Klik op Betaal → voltooide aankoop"
                num={res.metrics.paidPurchases}
                denom={res.metrics.checkoutClicks}
                hint="Hoeveel kliks daadwerkelijk een betaling worden"
              />
            </ul>
          </section>

          <p className="text-[11px] text-gray-400">
            Bezoekers worden geteld via een UUID in localStorage; geen
            persoonsgegevens, geen externe trackers.
          </p>
        </>
      )}
    </div>
  );
}
