import Link from "next/link";
import { Bell } from "lucide-react";
import { homeUnreadNotificationCount } from "@/data/me";

export function HomeHeader({ credits }: { credits: number }) {
  const unread = homeUnreadNotificationCount;

  return (
    <header className="flex items-center justify-between gap-3 px-5 pt-4">
      <h1 className="font-display text-[2.35rem] font-semibold leading-none tracking-tight text-ink lowercase">
        whisper
      </h1>

      <div className="mt-1.5 flex shrink-0 items-center gap-2">
        <Link
          href="/credits"
          className="inline-flex items-center gap-2 rounded-full border border-gray-100 bg-white py-1.5 pl-2 pr-3 shadow-sm transition active:scale-95"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 text-[11px] font-bold text-white">
            $
          </span>
          <span className="text-[14px] font-bold text-gray-900">{credits}</span>
        </Link>

        <Link
          href="/notifications"
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-gray-100 bg-white text-gray-500 shadow-sm transition active:scale-95"
          aria-label="Notifications"
        >
          <Bell className="h-[18px] w-[18px]" strokeWidth={2} />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#7C5CFF] px-0.5 text-[10px] font-bold leading-none text-white ring-2 ring-canvas">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
