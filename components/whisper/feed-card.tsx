"use client";

import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, MapPin, User } from "lucide-react";
import type { Profile } from "@/data/profiles";

type Props = {
  profile: Profile;
};

const INTEREST_EMOJI: Record<string, string> = {
  caring: "💗",
  romantic: "💜",
  playful: "✨",
  warm: "🌿",
  listener: "🎧",
};

/**
 * Side-by-side discover card: portrait photo on the left, scannable details on
 * the right (name, city, interests, view-profile button).
 */
export function FeedCard({ profile }: Props) {
  const isOnline =
    profile.status.variant === "online" || profile.status.variant === "active";

  return (
    <div className="relative flex h-full w-full overflow-hidden rounded-[28px] bg-white shadow-xl ring-1 ring-black/5">
      {/* Left: portrait photo */}
      <div className="relative h-full w-[46%] shrink-0 overflow-hidden bg-gray-100">
        <Image
          src={profile.photo}
          alt={profile.name}
          fill
          sizes="(max-width: 480px) 50vw, 220px"
          className="object-cover"
          priority
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-b from-transparent to-black/40"
          aria-hidden
        />
        <div className="absolute left-2 top-2 z-[1]">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-md">
            {isOnline && (
              <span
                className="h-1.5 w-1.5 rounded-full bg-green-400"
                aria-hidden
              />
            )}
            {profile.status.label}
          </span>
        </div>
      </div>

      {/* Right: details */}
      <div className="flex min-w-0 flex-1 flex-col p-4">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1">
            <h2 className="truncate text-[20px] font-extrabold leading-tight tracking-tight text-ink">
              {profile.name}, {profile.age}
            </h2>
            {profile.isVerified && (
              <BadgeCheck
                className="h-4 w-4 shrink-0 text-primary"
                strokeWidth={2.4}
                aria-hidden
              />
            )}
          </div>
          {profile.city && (
            <div className="mt-0.5 flex items-center gap-1 text-[12px] font-medium text-inkMuted">
              <MapPin className="h-3 w-3" strokeWidth={2.25} aria-hidden />
              <span className="truncate">{profile.city}</span>
            </div>
          )}
        </div>

        {profile.interests.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {profile.interests.slice(0, 4).map((interest) => (
              <span
                key={interest.label}
                className="inline-flex items-center gap-1 rounded-full bg-lavender px-2 py-0.5 text-[11px] font-semibold text-primary"
              >
                <span aria-hidden>
                  {INTEREST_EMOJI[interest.icon] ?? "✨"}
                </span>
                {interest.label}
              </span>
            ))}
          </div>
        )}

        <Link
          href={`/profile/${profile.id}`}
          className="mt-auto inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-gray-200 bg-white py-1.5 text-[12px] font-bold text-ink shadow-sm transition active:scale-[0.98]"
        >
          <User className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
          Bekijk profiel
        </Link>
      </div>
    </div>
  );
}
