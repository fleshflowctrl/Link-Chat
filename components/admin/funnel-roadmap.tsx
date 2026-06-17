import type { FunnelRoadmapMetrics } from "@/lib/admin/funnel-roadmap";

function formatPct(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0%";
  if (n >= 10) return `${Math.round(n)}%`;
  return `${n.toFixed(1)}%`;
}

function formatCount(n: number): string {
  return n.toLocaleString("nl-NL");
}

export function FunnelRoadmap({ data }: { data: FunnelRoadmapMetrics }) {
  const top = data.steps[0]?.count ?? 0;

  return (
    <div className="space-y-3">
      {data.steps.map((step, index) => {
        const barWidth =
          top > 0 ? Math.max(4, Math.round((step.count / top) * 100)) : 4;
        return (
          <div
            key={step.key}
            className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  Stap {index + 1}
                </p>
                <p className="mt-0.5 text-[15px] font-semibold text-zinc-100">
                  {step.label}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold tabular-nums text-white">
                  {formatCount(step.count)}
                </p>
                <p className="mt-0.5 text-[12px] text-zinc-400">
                  {formatPct(step.pctOfVisitors)} van bezoekers
                  {step.pctOfPrevious != null && index > 0 ? (
                    <>
                      {" "}
                      · {formatPct(step.pctOfPrevious)} van vorige stap
                    </>
                  ) : null}
                </p>
              </div>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#B52B2A] to-[#D63B3A] transition-[width] duration-500"
                style={{ width: `${barWidth}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
