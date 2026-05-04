"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import type { Profile, StatusChipVariant } from "@/data/profiles";

function chipStyles(variant: StatusChipVariant): string {
  const base =
    "inline-flex max-w-[calc(100%-0.5rem)] items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold leading-tight shadow-sm backdrop-blur-md";
  switch (variant) {
    case "active_now":
    case "online":
      return `${base} bg-accentGreen/25 text-emerald-900 ring-1 ring-accentGreen/30`;
    case "replied":
      return `${base} bg-amber-100/90 text-amber-900 ring-1 ring-amber-200/80`;
    case "new_here":
      return `${base} bg-accentPink/20 text-rose-900 ring-1 ring-accentPink/30`;
    case "popular":
      return `${base} bg-accentOrange/20 text-orange-950 ring-1 ring-accentOrange/35`;
    case "quiet_tonight":
      return `${base} bg-white/55 text-inkMuted ring-1 ring-black/5`;
    default:
      return `${base} bg-white/55 text-ink`;
  }
}

export function ProfileCard({ profile }: { profile: Profile }) {
  return (
    <Link
      href={`/profile/${profile.id}`}
      className="block min-h-[44px] outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      aria-label={`View ${profile.name}'s profile`}
    >
      <motion.article
        whileHover={{ scale: 0.98 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 520, damping: 36 }}
        className="relative aspect-[3/4.1] w-full overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/[0.04]"
      >
      <Image
        src={profile.imageUrl}
        alt={`${profile.name}, ${profile.age}`}
        fill
        sizes="(max-width: 430px) 50vw, 200px"
        className="object-cover"
        priority={profile.id === "maya" || profile.id === "marcus"}
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

      <div className="absolute left-3 top-3 z-10">
        <span className={chipStyles(profile.statusChip.variant)}>
          {profile.statusChip.variant === "replied" && (
            <Zap className="h-3 w-3 shrink-0 fill-amber-500 text-amber-600" />
          )}
          <span className="truncate">{profile.statusChip.label}</span>
        </span>
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-10 p-3.5">
        <div className="flex items-center gap-1.5">
          <h2 className="text-lg font-bold tracking-tight text-white drop-shadow-sm">
            {profile.name}, {profile.age}
          </h2>
          <span className="inline-flex h-2 w-2 shrink-0 rounded-full bg-accentGreen shadow-[0_0_0_2px_rgba(255,255,255,0.35)]" />
        </div>
        <p className="mt-0.5 text-[12px] font-medium text-white/85">
          {profile.distanceKm} km away · {profile.presenceLabel}
        </p>
        <p className="mt-2 inline-flex max-w-full rounded-full bg-white/20 px-3 py-1 text-[11px] font-medium leading-snug text-white ring-1 ring-white/25 backdrop-blur-md">
          <span className="line-clamp-2">{profile.bioSnippet}</span>
        </p>
      </div>
    </motion.article>
    </Link>
  );
}
