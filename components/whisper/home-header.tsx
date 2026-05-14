"use client";

import { CreditsPill } from "@/components/ui/credits-pill";

export function HomeHeader() {
  return (
    <header className="flex items-start justify-between gap-3 px-5 pb-1 pt-[max(1rem,env(safe-area-inset-top))]">
      <h1 className="font-display text-[2rem] font-semibold leading-none tracking-tight text-ink lowercase">
        whisper
      </h1>
      <CreditsPill />
    </header>
  );
}
