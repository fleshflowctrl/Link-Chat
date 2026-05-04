"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { BadgeCheck } from "lucide-react";
import {
  chatFilterChips,
  threadsForFilter,
  type ChatFilterId,
} from "@/data/messages";

export function MessagesView() {
  const [filter, setFilter] = useState<ChatFilterId | null>(null);
  const list = useMemo(() => threadsForFilter(filter), [filter]);

  return (
    <>
      <header className="px-5 pb-2 pt-4">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Messages</h1>
      </header>

      <div className="scrollbar-hide flex gap-4 overflow-x-auto px-5 pb-3 pt-1">
        {chatFilterChips.map((chip) => {
          const selected = filter === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() =>
                setFilter((f) => (f === chip.id ? null : chip.id))
              }
              className="flex w-[72px] shrink-0 flex-col items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <div
                className={`relative rounded-full p-[2.5px] transition-shadow ${
                  selected
                    ? "bg-gradient-primary shadow-card"
                    : "bg-gradient-to-br from-primary/80 to-primarySoft/90 shadow-sm"
                }`}
              >
                <div className="relative h-14 w-14 overflow-hidden rounded-full bg-canvas ring-2 ring-white">
                  <Image
                    src={chip.avatarUrl}
                    alt=""
                    width={112}
                    height={112}
                    className="h-full w-full object-cover"
                  />
                </div>
                {chip.showOnlineDot && (
                  <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-[2.5px] border-canvas bg-accentGreen shadow-sm" />
                )}
                {chip.badge && (
                  <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white shadow-md ring-2 ring-canvas">
                    {chip.badge.kind === "plus"
                      ? `+${chip.badge.value}`
                      : chip.badge.value}
                  </span>
                )}
              </div>
              <span
                className={`w-full text-center text-[10px] font-semibold leading-tight ${
                  selected ? "text-primary" : "text-ink/75"
                }`}
              >
                {chip.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mx-5 h-px bg-black/[0.06]" />

      <ul className="divide-y divide-black/[0.06] px-0 pb-4 pt-1">
        {list.map((thread) => (
          <li key={thread.id}>
            <Link
              href={`/messages/${thread.id}`}
              className="flex min-h-[72px] items-start gap-3 px-5 py-3.5 transition-colors active:bg-black/[0.03]"
            >
              <div className="relative shrink-0">
                <span className="relative block h-14 w-14 overflow-hidden rounded-full bg-lavender ring-1 ring-black/[0.06]">
                  <Image
                    src={thread.avatarUrl}
                    alt=""
                    width={112}
                    height={112}
                    className="h-full w-full object-cover"
                  />
                </span>
                {thread.showOnlineDot && (
                  <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-[2.5px] border-canvas bg-accentGreen shadow-sm" />
                )}
              </div>

              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-center gap-1">
                  <span className="truncate text-[16px] font-bold text-ink">
                    {thread.name}
                  </span>
                  {thread.verified && (
                    <BadgeCheck
                      className="h-[18px] w-[18px] shrink-0 text-primary"
                      strokeWidth={2}
                      aria-label="Verified"
                    />
                  )}
                </div>
                <p className="truncate text-[14px] text-inkMuted">
                  {thread.lastMessage}
                </p>
                {thread.onlineNow && (
                  <p className="mt-0.5 text-[12px] font-semibold text-primary">
                    Online now
                  </p>
                )}
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
                <span className="text-[12px] font-medium text-inkMuted">
                  {thread.timestampLabel}
                </span>
                {thread.unreadCount != null && thread.unreadCount > 0 && (
                  <span className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-white shadow-sm">
                    {thread.unreadCount}
                  </span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
