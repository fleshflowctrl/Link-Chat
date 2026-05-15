import type { DbHealthReport } from "@/lib/admin/db-health";

/** Loud "apply these migrations" banner shown at the top of the admin
 * surface when one or more canary columns are missing. Without this the
 * admin would just look broken — no clue what to do. */
export function MigrationBanner({ report }: { report: DbHealthReport }) {
  if (report.ok) return null;
  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-amber-200 bg-amber-50 shadow-sm">
      <div className="border-b border-amber-200 bg-amber-100/60 px-5 py-3">
        <p className="text-sm font-semibold text-amber-900">
          Database loopt achter op de code
        </p>
        <p className="mt-0.5 text-xs text-amber-800">
          Eén of meer migrations zijn nog niet toegepast op deze Supabase-instance. De
          admin werkt pas volledig zodra je ze runt — kopieer onderstaande SQL-bestanden
          naar de Supabase SQL Editor of voer <code className="rounded bg-white px-1 py-0.5 text-[11px]">supabase db push</code> uit.
        </p>
      </div>
      <ul className="divide-y divide-amber-200/70">
        {report.missing.map((m) => (
          <li key={m.file} className="flex items-center gap-3 px-5 py-2.5 text-xs">
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200 text-[10px] font-bold text-amber-900">
              !
            </span>
            <code className="rounded bg-white px-1.5 py-0.5 text-[11px] font-medium text-amber-900 ring-1 ring-amber-200">
              {m.file}
            </code>
            <span className="truncate text-amber-800">{m.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
