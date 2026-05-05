"use client";

import Image from "next/image";
import Link from "next/link";
import { getOnlineUsers } from "@/data/onlineUsers";

type OnlineNowRailProps = {
  /** Wrapper classes; default `pt-6` (home). Pass e.g. `pt-3` on Messages for tighter title gap. */
  className?: string;
  /** Narrower columns + slightly smaller avatars (Messages). */
  compact?: boolean;
  /**
   * When set (e.g. from Supabase catalog), replaces mock `getOnlineUsers()`.
   * Pass `[]` if no one is online — rail still renders with a zero count.
   */
  users?: ReturnType<typeof getOnlineUsers>;
};

export function OnlineNowRail({ className, compact, users: usersProp }: OnlineNowRailProps) {
  const users = usersProp ?? getOnlineUsers();
  const count = users.length;
  const col = compact ? "w-[64px]" : "w-[72px]";
  const inner = compact ? "h-[52px] w-[52px]" : "h-14 w-14";

  return (
    <div className={className ?? "pt-6"}>
      <div className="mb-3 flex items-center gap-2 px-5">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500/75 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
        </span>
        <span className="text-[15px] font-bold text-ink">Nu online</span>
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
          {count}
        </span>
      </div>

      <div className="scrollbar-hide flex gap-3 overflow-x-auto px-5 pb-1">
        {count === 0 && (
          <p className="px-1 pb-2 text-[13px] text-inkMuted">
            Niemand online — probeer het later opnieuw.
          </p>
        )}
        {users.map((user) => (
          <Link
            key={user.id}
            href={`/profile/${user.id}`}
            className={`flex ${col} shrink-0 flex-col items-center gap-1 text-center outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas`}
          >
            <div className="relative shrink-0">
              <div
                className="rounded-full p-[2px]"
                style={{
                  background:
                    "linear-gradient(135deg, #4ADE80 0%, #22C55E 100%)",
                }}
              >
                <div className="rounded-full bg-white p-[2px]">
                  <div
                    className={`relative ${inner} overflow-hidden rounded-full bg-lavender`}
                  >
                    <Image
                      src={user.avatar}
                      alt=""
                      width={112}
                      height={112}
                      className="h-full w-full object-cover"
                    />
                  </div>
                </div>
              </div>
              <span
                className="animate-pulse-dot absolute bottom-0 right-0 z-10 h-[14px] w-[14px] rounded-full border-[2.5px] border-white bg-green-500"
                aria-hidden
              />
            </div>
            <span className="w-full truncate text-[12px] font-semibold text-ink">
              {user.name}
            </span>
            <span className="w-full truncate text-[10px] font-medium text-green-600">
              Online
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
