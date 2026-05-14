"use client";

import Image from "next/image";
import { BadgeCheck, MapPin } from "lucide-react";
import type { Profile } from "@/data/profiles";

type Props = {
  profile: Profile;
  /** Personalized opener shown as a chat-bubble overlay on the card. */
  opener: string;
};

/**
 * Single full-bleed profile card used by the discover stack.
 *
 * The photo fills the card; a vertical gradient at the bottom keeps the name,
 * city and opener message readable. The status pill sits in the top-left so
 * "Nu online" / last-active context is immediately visible.
 */
export function FeedCard({ profile, opener }: Props) {
  const isOnline =
    profile.status.variant === "online" || profile.status.variant === "active";

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[28px] bg-gray-900 shadow-xl">
      <Image
        src={profile.photo}
        alt={profile.name}
        fill
        sizes="(max-width: 480px) 100vw, 440px"
        className="object-cover"
        priority
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/35 via-black/0 to-black/85"
        aria-hidden
      />

      {/* Status pill */}
      <div className="absolute left-3 top-3 z-[1]">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-md">
          {isOnline && (
            <span
              className="h-1.5 w-1.5 rounded-full bg-green-400"
              aria-hidden
            />
          )}
          {profile.status.label}
        </span>
      </div>

      {/* Name + city overlaid at the bottom */}
      <div className="absolute inset-x-0 bottom-0 z-[1] p-4">
        <div className="flex min-w-0 items-center gap-1.5">
          <h2 className="truncate text-2xl font-extrabold leading-tight tracking-tight text-white drop-shadow-md">
            {profile.name}, {profile.age}
          </h2>
          {profile.isVerified && (
            <BadgeCheck
              className="h-5 w-5 shrink-0 text-primary drop-shadow"
              strokeWidth={2.4}
              fill="white"
              aria-hidden
            />
          )}
        </div>
        {profile.city && (
          <div className="mt-1 flex items-center gap-1 text-[12px] font-medium text-white/85">
            <MapPin className="h-3 w-3" strokeWidth={2.25} aria-hidden />
            <span className="truncate">{profile.city}</span>
          </div>
        )}

        {/* Opener bubble */}
        <div className="mt-3 max-w-[90%] rounded-2xl bg-black/55 px-3.5 py-2.5 backdrop-blur-md">
          <p className="text-[14px] leading-snug text-white">{opener}</p>
        </div>
      </div>
    </div>
  );
}
