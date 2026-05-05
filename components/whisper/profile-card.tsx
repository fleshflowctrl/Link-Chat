"use client";

import Image from "next/image";
import Link from "next/link";
import { MapPin, User } from "lucide-react";
import { type ReactNode } from "react";
import type { Profile, ProfileStatusVariant } from "@/data/profiles";

function statusChipClasses(variant: ProfileStatusVariant): string {
  const base =
    "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold text-white backdrop-blur";
  switch (variant) {
    case "active":
    case "online":
      return `${base} bg-green-500/95`;
    case "replied":
      return `${base} bg-amber-400/95`;
    case "new":
      return `${base} bg-pink-500/95`;
    case "popular":
      return `${base} bg-orange-500/95`;
    case "quiet":
      return `${base} bg-gray-700/80`;
    default:
      return `${base} bg-green-500/95`;
  }
}

function StatusChip({ status }: { status: Profile["status"] }) {
  const { variant, label } = status;
  const dot = (
    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white" aria-hidden />
  );

  let prefix: ReactNode = null;
  if (variant === "replied") prefix = <span aria-hidden>⚡</span>;
  if (variant === "popular") prefix = <span aria-hidden>🔥</span>;
  if (variant === "quiet") prefix = <span aria-hidden>🌙</span>;

  const showDot = variant === "active" || variant === "online";

  return (
    <span className={`${statusChipClasses(variant)} max-w-full min-w-0`}>
      {showDot && dot}
      {prefix}
      <span className="min-w-0 truncate">{label}</span>
    </span>
  );
}

export function ProfileCard({ profile }: { profile: Profile }) {
  const profileHref = `/profile/${profile.id}`;

  return (
    <article className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl shadow-md">
      <Image
        src={profile.photo}
        alt=""
        fill
        sizes="(max-width: 430px) 50vw, 200px"
        className="object-cover"
        priority={profile.id === "maya" || profile.id === "marcus"}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />

      <Link
        href={profileHref}
        tabIndex={-1}
        className="absolute inset-0 z-[1] outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black/30"
        aria-label={`View ${profile.name}'s profile`}
      />

      <div className="pointer-events-none absolute left-3 top-3 z-[2] max-w-[calc(100%-1rem)]">
        <StatusChip status={profile.status} />
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-[2] flex flex-col p-3">
        <div className="pointer-events-none min-w-0">
          <div className="flex min-w-0 items-baseline gap-1.5">
            <h2 className="min-w-0 truncate text-[18px] font-bold leading-tight text-white">
              {profile.name}, {profile.age}
            </h2>
            <span className="inline-flex shrink-0 items-baseline gap-1 text-[11px] text-white/80">
              <span aria-hidden>·</span>
              <MapPin className="size-3 shrink-0" strokeWidth={2.25} aria-hidden />
              <span>{profile.distanceKm} km</span>
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-white/85">
            {profile.bioSnippet}
          </p>
        </div>

        <Link
          href={profileHref}
          className="relative z-[3] mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-full bg-white py-2 text-[12px] font-semibold text-gray-900 outline-none transition focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black/30 active:scale-[0.98]"
        >
          <User className="size-3.5 shrink-0" strokeWidth={2.25} aria-hidden />
          View profile
        </Link>
      </div>
    </article>
  );
}
