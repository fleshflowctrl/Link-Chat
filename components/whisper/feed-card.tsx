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
 * Full-bleed discover card: portrait photo fills the entire card, all
 * meta (status chip, name+age, city, interests, "Bekijk profiel" CTA)
 * is overlaid on top of the image. A bottom gradient keeps text legible
 * no matter how light or busy the photo behind it is.
 */
export function FeedCard({ profile }: Props) {
  const isOnline =
    profile.status.variant === "online" || profile.status.variant === "active";
  const isNew = profile.status.variant === "new";
  const showStatusChip = profile.status.label.trim().length > 0;
  const chipMotionClass = isNew
    ? "animate-discover-badge-new"
    : isOnline
      ? "animate-discover-badge-live"
      : "";

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[28px] bg-gray-200 shadow-xl ring-1 ring-black/5">
      <Image
        src={profile.photo}
        alt={profile.name}
        fill
        sizes="(max-width: 480px) 100vw, 420px"
        className="object-cover"
        priority
        fetchPriority="high"
      />

      {/* Dark bottom gradient so overlaid text is always legible. Stronger
       * than a 1/4 fade because we now stack name + city + interests +
       * CTA on top of it. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/90 via-black/55 to-transparent"
        aria-hidden
      />
      {/* Soft top fade so the status chip pops on bright sky/snow photos. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/40 to-transparent"
        aria-hidden
      />

      {/* Status chip — top left (only ~20% of discover cards) */}
      {showStatusChip && (
        <div className="absolute left-3 top-3 z-[1]">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-md ${chipMotionClass} ${
              isNew ? "bg-pink-500/90" : "bg-black/55"
            }`}
          >
            {isOnline && (
              <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
              </span>
            )}
            {profile.status.label}
          </span>
        </div>
      )}

      {/* Overlay content — bottom */}
      <div className="absolute inset-x-0 bottom-0 z-[1] p-4 text-white">
        <div className="flex min-w-0 items-center gap-1.5">
          <h2 className="truncate text-[26px] font-extrabold leading-tight tracking-tight drop-shadow-md">
            {profile.name}, {profile.age}
          </h2>
          {profile.isVerified && (
            <BadgeCheck
              className="h-5 w-5 shrink-0 text-white drop-shadow-md"
              strokeWidth={2.4}
              aria-hidden
            />
          )}
        </div>
        {profile.city && (
          <div className="mt-1 flex items-center gap-1 text-[13px] font-medium text-white/95 drop-shadow">
            <MapPin className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
            <span className="truncate">{profile.city}</span>
          </div>
        )}

        {profile.interests.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {profile.interests.slice(0, 4).map((interest) => (
              <span
                key={interest.label}
                className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md ring-1 ring-white/25"
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
          className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-white/95 py-2.5 text-[13px] font-bold text-ink shadow-lg ring-1 ring-black/5 backdrop-blur-md transition active:scale-[0.98]"
        >
          <User className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
          Bekijk profiel
        </Link>
      </div>
    </div>
  );
}
