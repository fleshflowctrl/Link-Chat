"use client";

import Image from "next/image";
import Link from "next/link";
import type { OnlineUser } from "@/data/onlineUsers";

type OnlineNowRailProps = {
  /** Wrapper classes; default `pt-6` (home). Pass e.g. `pt-3` on Messages for tighter title gap. */
  className?: string;
  /** Narrower columns + slightly smaller avatars (Messages). */
  compact?: boolean;
  /** Real online users from the catalog — omit to hide the rail. */
  users: OnlineUser[];
};

export function OnlineNowRail({ className, compact, users }: OnlineNowRailProps) {
  if (users.length === 0) return null;

  const col = compact ? "w-[64px]" : "w-[72px]";
  const inner = compact ? "h-[52px] w-[52px]" : "h-14 w-14";

  return (
    <div className={className ?? "pt-6"}>
      <div className="mb-3 flex items-center gap-2 px-5">
        <span className="text-[15px] font-bold text-ink">Actief</span>
      </div>

      <div className="scrollbar-hide flex gap-3 overflow-x-auto px-5 pb-1">
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
            </div>
            <span className="w-full truncate text-[12px] font-semibold text-ink">
              {user.name}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
