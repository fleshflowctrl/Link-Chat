"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { homeUnreadNotificationCount } from "@/data/me";
import { CreditsPill } from "@/components/ui/credits-pill";

export function HomeHeader() {
  const unread = homeUnreadNotificationCount;

  return (
    <header className="flex items-center justify-between gap-2 px-4 pb-1 pt-[max(1rem,env(safe-area-inset-top))]">
      <h1 className="font-display text-[2rem] font-semibold leading-none tracking-tight text-ink lowercase">
        whisper
      </h1>

      <div className="flex shrink-0 items-center gap-1.5">
        <CreditsPill />

        <Link
          href="/notifications"
          className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-100 bg-white text-gray-500 shadow-sm transition active:scale-95"
          aria-label="Meldingen"
        >
          <Bell className="h-[17px] w-[17px]" strokeWidth={2} />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#7C5CFF] px-0.5 text-[9px] font-bold leading-none text-white ring-2 ring-canvas">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
