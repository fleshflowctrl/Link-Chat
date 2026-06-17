"use client";

import Image from "next/image";
import { VariantLink as Link } from "@/components/variant-link";
import { useAppVariant } from "@/components/app-variant-provider";
import { withVariantPath } from "@/lib/app-variant";
import { GuestPhotoLockOverlay } from "@/components/discover/guest-photo-lock-message";
import { MapPin, User } from "lucide-react";
import { useState } from "react";
import type { Profile } from "@/data/profiles";

type Props = {
  profile: Profile;
  compact?: boolean;
  photoLocked?: boolean;
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
export function FeedCard({ profile, compact = false, photoLocked = false }: Props) {
  const { variant } = useAppVariant();
  const isV2 = variant === "v2";
  const [photoLoaded, setPhotoLoaded] = useState(false);
  const isPresenceStatus =
    profile.status.variant === "online" || profile.status.variant === "active";
  const isNew = profile.status.variant === "new";
  const showStatusChip =
    !isPresenceStatus && profile.status.label.trim().length > 0;
  const chipMotionClass = isNew ? "animate-discover-badge-new" : "";

  return (
    <div
      className={
        compact
          ? "relative h-full w-full overflow-hidden rounded-2xl bg-gray-200 shadow-lg ring-1 ring-black/5"
          : "relative h-full w-full overflow-hidden rounded-[28px] bg-gray-200 shadow-xl ring-1 ring-black/5"
      }
    >
      <Image
        src={profile.photo}
        alt={profile.name}
        fill
        sizes="(max-width: 480px) 100vw, 420px"
        className="object-cover"
        style={
          photoLocked
            ? {
                filter: "blur(24px)",
                opacity: photoLoaded ? 0.35 : 0,
                transform: "scale(1.08)",
                transition: "opacity 220ms ease",
              }
            : undefined
        }
        onLoad={() => setPhotoLoaded(true)}
        priority
        fetchPriority="high"
      />

      {photoLocked && (
        <GuestPhotoLockOverlay profileName={profile.name} size="md" />
      )}

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
            {profile.status.label}
          </span>
        </div>
      )}

      {/* Overlay content — bottom (above photo-lock layer) */}
      <div
        className={
          compact
            ? "absolute inset-x-0 bottom-0 z-[3] p-3 text-white"
            : "absolute inset-x-0 bottom-0 z-[3] p-4 text-white"
        }
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <h2
            className={
              compact
                ? "truncate text-[22px] font-extrabold leading-tight tracking-tight text-white drop-shadow-md"
                : "truncate text-[26px] font-extrabold leading-tight tracking-tight text-white drop-shadow-md"
            }
          >
            {profile.name}, {profile.age}
          </h2>
        </div>
        {profile.city && (
          <div className="mt-1 flex items-center gap-1 text-[13px] font-medium text-white/80 drop-shadow">
            <MapPin
              className="h-3.5 w-3.5 text-white/70"
              strokeWidth={2.25}
              aria-hidden
            />
            <span className="truncate">{profile.city}</span>
          </div>
        )}
        {profile.bio.trim() && (
          <p
            className={
              compact
                ? "mt-1 line-clamp-2 text-[12px] font-normal leading-snug text-white/55 drop-shadow"
                : "mt-1.5 line-clamp-2 text-[13px] font-normal leading-snug text-white/55 drop-shadow"
            }
          >
            {profile.bio}
          </p>
        )}

        {profile.interests.length > 0 && !compact && (
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
          href={withVariantPath(`/profile/${profile.id}`, variant)}
          className={
            (compact
              ? "relative z-[4] mt-3 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full py-3.5 text-[15px] font-bold shadow-lg backdrop-blur-md transition active:scale-[0.98] "
              : "relative z-[4] mt-4 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full py-3.5 text-[15px] font-bold shadow-lg backdrop-blur-md transition active:scale-[0.98] ") +
            (isV2
              ? "bg-white/95 text-[#3D3D3D] ring-1 ring-white/30"
              : "bg-white/95 text-ink ring-1 ring-black/5")
          }
          onPointerDown={(e) => e.stopPropagation()}
        >
          <User className="h-5 w-5 shrink-0" strokeWidth={2.5} aria-hidden />
          Bekijk profiel
        </Link>
      </div>
    </div>
  );
}
