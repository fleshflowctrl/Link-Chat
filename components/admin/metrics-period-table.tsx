import type { MetricsPeriodRow } from "@/lib/admin/metrics";

function nf(n: number): string {
  return n.toLocaleString("nl-NL");
}

function euro(cents: number): string {
  return `€ ${(cents / 100).toLocaleString("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

type MetricsPeriodTableProps = {
  months: MetricsPeriodRow[];
  totals: {
    revenueCents: number;
    users: number;
    purchases: number;
  };
  variant?: string;
  since: string | null;
};

export function MetricsPeriodTable({
  months,
  totals,
  since,
}: MetricsPeriodTableProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
      <header className="border-b border-black/5 px-5 py-4">
        <h2 className="text-sm font-semibold tracking-tight text-gray-900">
          Per maand
        </h2>
        <p className="mt-0.5 text-xs text-gray-500">
          {since
            ? "Sign-ups en aankopen gegroepeerd per kalendermaand binnen de huidige periode."
            : "Sign-ups en aankopen gegroepeerd per kalendermaand (all-time)."}
        </p>
      </header>

      {months.length === 0 ? (
        <p className="px-5 py-8 text-sm text-gray-500">
          Nog geen data in deze periode.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-black/5 bg-gray-50/80 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-5 py-3">Maand</th>
                <th className="px-5 py-3 text-right">Users</th>
                <th className="px-5 py-3 text-right">Aankopen</th>
                <th className="px-5 py-3 text-right">Betalers</th>
                <th className="px-5 py-3 text-right">Omzet</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {months.map((row) => (
                <tr key={row.key} className="text-gray-900">
                  <td className="px-5 py-3 font-medium">{row.label}</td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {nf(row.users)}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {nf(row.purchases)}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {nf(row.payingUsers)}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {euro(row.revenueCents)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-black/5 bg-gray-50/50 text-gray-900">
              <tr className="font-semibold">
                <td className="px-5 py-3">Totaal</td>
                <td className="px-5 py-3 text-right tabular-nums">
                  {nf(totals.users)}
                </td>
                <td className="px-5 py-3 text-right tabular-nums">
                  {nf(totals.purchases)}
                </td>
                <td className="px-5 py-3 text-right tabular-nums">—</td>
                <td className="px-5 py-3 text-right tabular-nums">
                  {euro(totals.revenueCents)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
