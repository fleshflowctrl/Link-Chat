import Link from "next/link";
import {
  FUNNEL_PERIOD_OPTIONS,
  type FunnelPeriod,
} from "@/lib/admin/funnel-period";

export function FunnelPeriodTabs({ active }: { active: FunnelPeriod }) {
  return (
    <div className="flex flex-wrap gap-2">
      {FUNNEL_PERIOD_OPTIONS.map((opt) => {
        const isActive = opt.value === active;
        const href =
          opt.value === "live" ? "/admin/roadmap" : `/admin/roadmap?period=${opt.value}`;
        return (
          <Link
            key={opt.value}
            href={href}
            className={
              isActive
                ? "rounded-xl bg-[#B52B2A] px-3 py-2 text-[13px] font-semibold text-white"
                : "rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-[13px] font-semibold text-zinc-200 hover:bg-zinc-700"
            }
          >
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}
