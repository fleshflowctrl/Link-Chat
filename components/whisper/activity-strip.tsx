"use client";

import Image from "next/image";
import { VariantLink as Link } from "@/components/variant-link";
import { useAppVariant } from "@/components/app-variant-provider";
import { withVariantPath } from "@/lib/app-variant";
import { Sparkles } from "lucide-react";
import type { NewWhisperUser } from "@/data/newUsers";
import { SITE_NAME } from "@/lib/brand";
import { showNewJoinBadge } from "@/data/newUsers";
import { V2_GRADIENT_RING, V2_THEME } from "@/lib/v2-theme";

export function ActivityStrip({ users }: { users: NewWhisperUser[] }) {
  const { variant } = useAppVariant();
  const isV2 = variant === "v2";

  return (
    <div className="px-4 pt-0">
      <div
        className={
          isV2
            ? "overflow-hidden rounded-2xl bg-[#252526] px-3 pb-3 pt-2.5 ring-1 ring-[#B52B2A]/20"
            : "overflow-hidden rounded-2xl bg-[#EDE7FF] px-3 pb-3 pt-2.5"
        }
      >
        <div className="mb-1.5 flex min-w-0 items-center gap-1.5">
          <Sparkles
            className="h-4 w-4 shrink-0 text-primary"
            strokeWidth={2.25}
            aria-hidden
          />
          <h2 className="truncate text-[15px] font-bold text-ink">
            Nieuw op {SITE_NAME}
          </h2>
        </div>

        <div className="scrollbar-hide flex gap-3 overflow-x-auto pt-0.5">
          {users.map((user) => (
            <Link
              key={user.id}
              href={withVariantPath(`/profile/${user.id}`, variant)}
              className="flex w-[68px] shrink-0 flex-col items-center gap-1 text-center"
            >
              <div className="relative shrink-0">
                <div
                  className="rounded-full p-[2px]"
                  style={{
                    background: isV2
                      ? V2_GRADIENT_RING
                      : "linear-gradient(135deg, #9B7BFF 0%, #7C5CFF 100%)",
                  }}
                >
                  <div className="rounded-full bg-white p-[2px]">
                    <div className="relative h-14 w-14 overflow-hidden rounded-full bg-lavender">
                      <Image
                        src={user.avatar}
                        alt=""
                        width={140}
                        height={140}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  </div>
                </div>
                {showNewJoinBadge(user.joinedAt) && (
                  <span
                    className={`absolute -right-0.5 -top-0.5 z-10 rounded-full px-1 py-0.5 text-[7px] font-bold uppercase leading-none tracking-wide text-white shadow-sm ring-[2px] ${
                      isV2
                        ? "bg-[#B52B2A] ring-[#252526]"
                        : "bg-[#EC4899] ring-[#EDE7FF]"
                    }`}
                  >
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
