"use client";

import Image from "next/image";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { NewWhisperUser } from "@/data/newUsers";
import { showNewJoinBadge } from "@/data/newUsers";

export function ActivityStrip({ users }: { users: NewWhisperUser[] }) {

  return (
    <div className="px-4 pt-5">
      <div className="rounded-2xl bg-[#EDE7FF] p-3">
        <div className="mb-2 flex min-w-0 items-center gap-1.5">
          <Sparkles
            className="h-4 w-4 shrink-0 text-primary"
            strokeWidth={2.25}
            aria-hidden
          />
          <h2 className="truncate text-[15px] font-bold text-ink">
            Nieuw op whisper
          </h2>
        </div>

        <div className="scrollbar-hide -mx-1 flex gap-3 overflow-x-auto px-1 pt-0.5">
          {users.map((user) => (
            <Link
              key={user.id}
              href={`/profile/${user.id}`}
              className="flex w-[60px] shrink-0 flex-col items-center gap-1 text-center"
            >
              <div className="relative shrink-0">
                <div
                  className="rounded-full p-[2px]"
                  style={{
                    background:
                      "linear-gradient(135deg, #9B7BFF 0%, #7C5CFF 100%)",
                  }}
                >
                  <div className="rounded-full bg-white p-[2px]">
                    <div className="relative h-11 w-11 overflow-hidden rounded-full bg-lavender">
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
                {showNewJoinBadge(user.joinedAt) && (
                  <span className="absolute -right-0.5 -top-0.5 z-10 rounded-full bg-[#EC4899] px-1 py-0.5 text-[7px] font-bold uppercase leading-none tracking-wide text-white shadow-sm ring-[2px] ring-[#EDE7FF]">
                    NIEUW
                  </span>
                )}
              </div>
              <span className="w-full truncate text-[11px] font-semibold text-ink">
                {user.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
