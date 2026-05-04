"use client";

import { usePathname } from "next/navigation";
import { getPageNumber } from "@/lib/page-numbers";

export function PageNumberBadge() {
  const pathname = usePathname();
  const n = getPageNumber(pathname);
  if (n <= 0) return null;

  return (
    <div
      className="pointer-events-none absolute left-2 top-2 z-[200] select-none rounded-md bg-canvas/85 px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums leading-none text-ink/45 shadow-sm ring-1 ring-black/[0.06] backdrop-blur-sm"
      aria-hidden
    >
      {n}
    </div>
  );
}
