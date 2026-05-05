"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { type ReactNode } from "react";
import type { Profile, ProfileStatusVariant } from "@/data/profiles";

function statusChipClasses(variant: ProfileStatusVariant): string {
  const base =
    "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold text-white backdrop-blur";
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
    <span className={statusChipClasses(variant)}>
      {showDot && dot}
      {prefix}
      <span>{label}</span>
    </span>
  );
}

export function ProfileCard({ profile }: { profile: Profile }) {
  const profileHref = `/profile/${profile.id}`;

  return (
    <Link
      href={profileHref}
      className="block w-full overflow-hidden rounded-2xl bg-white shadow-sm outline-none ring-black/5 transition active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2"
      aria-label={`Profiel van ${profile.name} bekijken`}
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden">
        <Image
          src={profile.photo}
          alt=""
          fill
          sizes="(max-width: 430px) 50vw, 200px"
          className="object-cover"
          priority={
            profile.id === "maya" ||
            profile.id === "janifer" ||
            profile.id === "marcus"
          }
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent"
          aria-hidden
        />

        <div className="absolute left-3 top-3 z-[1] max-w-[calc(100%-1.5rem)]">
          <StatusChip status={profile.status} />
        </div>

        <div className="pointer-events-none absolute bottom-2 left-3 right-3 z-[1]">
          <p className="text-[18px] font-extrabold leading-tight text-white">
            {profile.name}, {profile.age}
          </p>
        </div>
      </div>

      <div className="p-3">
        <div className="flex items-center gap-1 text-[11px] text-gray-500">
          <MapPin className="size-3 shrink-0" strokeWidth={2.25} aria-hidden />
          <span>{profile.city}</span>
        </div>
        <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-gray-700">
          {profile.bio}
        </p>
        <div className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full bg-gray-900 py-2 text-[12px] font-bold text-white">
          Profiel bekijken
          <ArrowRight className="size-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
        </div>
      </div>
    </Link>
  );
}
