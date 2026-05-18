import type { AdminMetrics } from "@/lib/admin/metrics";
import { pct } from "@/lib/admin/metrics";

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

/**
 * Pure presentation of the admin metrics. Both /admin/metrics (live) and
 * /admin/metrics/totaal (all-time) render this with their own data.
 */
export function MetricsDashboard({ metrics }: { metrics: AdminMetrics }) {
  return (
    <>
      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard
          label="Website bezoekers"
          value={nf(metrics.visitors)}
          hint={`${nf(metrics.visitorsLast7d)} laatste 7d · ${nf(metrics.visitorsLast30d)} laatste 30d`}
          tone="primary"
        />
        <StatCard
          label="Sign-ups"
          value={nf(metrics.signups)}
          hint={`${nf(metrics.signupsLast7d)} laatste 7d · ${nf(metrics.signupsLast30d)} laatste 30d`}
          tone="success"
        />
        <StatCard
          label="Chattende users"
          value={nf(metrics.chatters)}
          hint={`${nf(metrics.totalUserMessages)} berichten verstuurd`}
        />
        <StatCard
          label="Betalende klanten"
          value={nf(metrics.payingUsers)}
          hint="Minstens 1 credit-pack gekocht"
          tone="warn"
        />
        <StatCard
          label="Unieke betaal-klikkers"
          value={nf(metrics.checkoutClickers)}
          hint={`${nf(metrics.checkoutClicks)} totale kliks · ${nf(metrics.checkoutClicksLast7d)} laatste 7d`}
          tone="primary"
        />
        <StatCard
          label="Voltooide aankopen"
          value={nf(metrics.paidPurchases)}
          hint={`${nf(metrics.paidPurchasesLast7d)} laatste 7d · klik → koop ${pctLabel(pct(metrics.paidPurchases, metrics.checkoutClicks))}`}
          tone="success"
        />
        <StatCard
          label="Berichten per sign-up"
          value={nf(metrics.avgMessagesPerSignup, 1)}
          hint="Gemiddeld over alle accounts"
        />
        <StatCard
          label="Credits gebruikt per sign-up"
          value={nf(metrics.avgCreditsSpentPerSignup, 0)}
          hint={`${nf(metrics.avgCreditsSpentPerChatter, 0)} gem. per chattende user · totaal ${nf(metrics.creditsSpentTotal)} uitgegeven`}
          tone="warn"
        />
        <StatCard
          label="Bezoekers → sign-up"
          value={nf(metrics.visitorsConvertedToSignup)}
          hint="Met visitor-cookie gekoppeld"
        />
        <StatCard
          label="Bezoekers → chat"
          value={nf(metrics.visitorsConvertedToChat)}
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
            num={metrics.visitorsConvertedToSignup}
            denom={metrics.visitors}
            hint="Cookies sinds tracking aanstond"
          />
          <FunnelRow
            label="Bezoeker → chat"
            num={metrics.visitorsConvertedToChat}
            denom={metrics.visitors}
            hint="Visitor die ook chatte"
          />
          <FunnelRow
            label="Sign-up → chat"
            num={metrics.chatters}
            denom={metrics.signups}
            hint="Account met ≥1 verzonden bericht"
          />
          <FunnelRow
            label="Sign-up → betalende klant"
            num={metrics.payingUsers}
            denom={metrics.signups}
            hint="Account met ≥1 credit-pack aankoop"
          />
          <FunnelRow
            label="Sign-up → klikte op Betaal"
            num={metrics.checkoutClickers}
            denom={metrics.signups}
            hint="Unieke users die minstens 1× op Betaal klikten"
          />
          <FunnelRow
            label="Betaal-klikker → betaalde klant"
            num={metrics.payingUsers}
            denom={metrics.checkoutClickers}
            hint="Van de mensen die klikten — hoeveel rondden af"
          />
          <FunnelRow
            label="Klik op Betaal → voltooide aankoop"
            num={metrics.paidPurchases}
            denom={metrics.checkoutClicks}
            hint="Per losse klik (incl. herhalingen door dezelfde user)"
          />
        </ul>
      </section>

      <section className="mb-8 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
        <header className="border-b border-black/5 px-5 py-4">
          <h2 className="text-sm font-semibold tracking-tight text-gray-900">
            Retentie
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Van de users die al lang genoeg een account hebben — hoeveel
            stuurden ≥ N dagen ná hun signup nog een bericht?
          </p>
        </header>
        <ul className="divide-y divide-black/5">
          {metrics.retention.map((r) => (
            <FunnelRow
              key={r.days}
              label={`D${r.days} retentie`}
              num={r.retained}
              denom={r.eligible}
              hint={
                r.eligible === 0
                  ? "Nog geen accounts ouder dan deze periode"
                  : `Cohort: accounts ≥ ${r.days} dag${r.days === 1 ? "" : "en"} oud`
              }
            />
          ))}
        </ul>
      </section>

      <section className="mb-8 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
        <header className="border-b border-black/5 px-5 py-4">
          <h2 className="text-sm font-semibold tracking-tight text-gray-900">
            Funnel doorloop — per stap
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Unieke bezoekers per onboarding-stap. Drop-off is het verschil
            met de vorige stap.
          </p>
        </header>
        <ul className="divide-y divide-black/5">
          {metrics.funnelSteps.map((s, i) => {
            const base = metrics.funnelSteps[0]?.visitors ?? 0;
            const prev = i > 0 ? metrics.funnelSteps[i - 1].visitors : null;
            const dropoff =
              prev !== null && prev > 0 ? Math.max(0, prev - s.visitors) : 0;
            const dropoffPct =
              prev !== null && prev > 0 ? (dropoff / prev) * 100 : 0;
            const reachPct = base > 0 ? (s.visitors / base) * 100 : 0;
            return (
              <li key={s.step} className="flex items-center gap-4 px-5 py-4">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[12px] font-bold text-gray-600">
                  {s.step}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">
                    {s.label}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {prev === null
                      ? "Startpunt van de funnel"
                      : dropoff > 0
                        ? `−${nf(dropoff)} bezoeker${dropoff === 1 ? "" : "s"} (${pctLabel(dropoffPct)} drop-off)`
                        : "Niemand viel hier af"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <div className="hidden h-2 w-40 overflow-hidden rounded-full bg-gray-100 sm:block">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-pink-400"
                      style={{ width: `${Math.min(100, reachPct)}%` }}
                    />
                  </div>
                  <div className="w-20 text-right text-sm font-semibold tabular-nums text-gray-900">
                    {pctLabel(reachPct)}
                  </div>
                  <div className="w-24 text-right text-xs tabular-nums text-gray-500">
                    {nf(s.visitors)} bezoekers
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="text-[11px] text-gray-400">
        Bezoekers worden geteld via een UUID in localStorage; geen
        persoonsgegevens, geen externe trackers.
      </p>
    </>
  );
}
