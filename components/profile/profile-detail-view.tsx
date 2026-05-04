"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Heart,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Share2,
  Headphones,
  Users,
  Smile,
} from "lucide-react";
import type { Profile, ProfileInterestIcon } from "@/data/profiles";

function InterestGlyph({
  icon,
  className,
}: {
  icon: ProfileInterestIcon;
  className?: string;
}) {
  const cn = `h-3.5 w-3.5 shrink-0 ${className ?? ""}`;
  switch (icon) {
    case "caring":
      return <Heart className={cn} fill="currentColor" strokeWidth={0} />;
    case "romantic":
      return (
        <Heart className={`${cn} fill-transparent`} strokeWidth={2.5} />
      );
    case "playful":
      return <Smile className={cn} strokeWidth={2.25} />;
    case "warm":
      return <Users className={cn} strokeWidth={2.25} />;
    case "listener":
      return <Headphones className={cn} strokeWidth={2.25} />;
    default:
      return null;
  }
}

function interestIconColor(icon: ProfileInterestIcon): string {
  switch (icon) {
    case "caring":
      return "text-accentPink";
    case "romantic":
      return "text-primary";
    case "playful":
      return "text-amber-500";
    case "warm":
      return "text-accentGreen";
    case "listener":
      return "text-primary";
    default:
      return "text-ink";
  }
}

export function ProfileDetailView({ profile }: { profile: Profile }) {
  const router = useRouter();
  const gallery = profile.gallery;
  const [heroIndex, setHeroIndex] = useState(0);
  const [liked, setLiked] = useState(false);

  const heroSrc = gallery[heroIndex] ?? profile.photo;

  const thumbSlots = useMemo(
    () =>
      [0, 1, 2, 3, 4].map((i) => ({
        src: gallery[i] ?? gallery[Math.min(i, Math.max(0, gallery.length - 1))],
        index: i,
        overlay:
          i === 4 && gallery.length > 5
            ? `+${gallery.length - 5}`
            : undefined,
      })),
    [gallery],
  );

  return (
    <div className="pb-4">
      <div className="relative h-[70vh] min-h-[340px] w-full overflow-hidden bg-ink/10">
        <Image
          src={heroSrc}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/50" />

        <div className="absolute left-0 right-0 top-0 z-20 flex items-start justify-between p-4 pt-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white shadow-lg ring-1 ring-white/15 backdrop-blur-sm transition active:scale-95"
            aria-label="Back"
          >
            <ChevronLeft className="h-6 w-6" strokeWidth={2.25} />
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => console.log("[profile] Share placeholder")}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white shadow-lg ring-1 ring-white/15 backdrop-blur-sm transition active:scale-95"
              aria-label="Share"
            >
              <Share2 className="h-5 w-5" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => console.log("[profile] More options placeholder")}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white shadow-lg ring-1 ring-white/15 backdrop-blur-sm transition active:scale-95"
              aria-label="More"
            >
              <MoreHorizontal className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 z-10 p-5 pb-28">
          <div className="inline-flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 text-[12px] font-semibold text-white ring-1 ring-white/20 backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-accentGreen shadow-[0_0_0_2px_rgba(255,255,255,0.35)]" />
            Online now
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <h1 className="text-4xl font-bold tracking-tight text-white drop-shadow-md">
              {profile.name}, {profile.age}
            </h1>
            {profile.isVerified && (
              <BadgeCheck
                className="h-8 w-8 shrink-0 text-primary drop-shadow-md"
                strokeWidth={2}
                aria-label="Verified"
              />
            )}
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[15px] font-medium text-white/95 drop-shadow">
            <MapPin className="h-4 w-4 shrink-0 text-white" strokeWidth={2.25} />
            {profile.distanceKm} km away
          </p>
          <span className="mt-3 inline-flex rounded-full bg-primary px-3 py-1.5 text-[12px] font-bold text-white shadow-lg ring-2 ring-white/25">
            {profile.lastActive}
          </span>
        </div>
      </div>

      <div className="relative z-10 -mt-10 rounded-t-[1.75rem] bg-canvas px-5 pb-6 pt-4 shadow-[0_-12px_48px_-12px_rgba(0,0,0,0.12)]">
        <div className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto pb-2 pt-1">
          {thumbSlots.map((slot) => {
            const active = heroIndex === slot.index;
            return (
              <button
                key={slot.index}
                type="button"
                onClick={() => setHeroIndex(slot.index)}
                className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl ring-2 transition ${
                  active ? "ring-primary ring-offset-2 ring-offset-canvas" : "ring-transparent"
                }`}
              >
                <Image
                  src={slot.src}
                  alt=""
                  width={128}
                  height={128}
                  className="h-full w-full object-cover"
                />
                {slot.overlay && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-[13px] font-bold text-white">
                    {slot.overlay}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => console.log("[profile] Looking for — placeholder")}
          className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-orange-100 via-rose-100 to-pink-200 px-4 py-3.5 text-left shadow-card ring-1 ring-accentPink/20"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accentPink to-primary text-white shadow-md">
            <Heart className="h-5 w-5" fill="currentColor" strokeWidth={0} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-accentPink">
              Looking for
            </p>
            <p className="text-[15px] font-bold leading-snug text-ink">
              {profile.lookingFor}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-ink/30" strokeWidth={2} />
        </button>

        <section className="mt-8">
          <h2 className="text-lg font-bold text-ink">About me</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-inkMuted">
            {profile.bio}
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-bold text-ink">Interests</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {profile.interests.map((item) => (
              <span
                key={item.label}
                className="inline-flex items-center gap-1.5 rounded-full bg-ink/[0.06] px-3 py-2 text-[13px] font-semibold text-ink ring-1 ring-black/[0.04]"
              >
                <span className={interestIconColor(item.icon)}>
                  <InterestGlyph icon={item.icon} />
                </span>
                {item.label}
              </span>
            ))}
            <button
              type="button"
              onClick={() => console.log("[profile] Add more interests")}
              className="inline-flex items-center rounded-full border-2 border-dashed border-primary/50 bg-transparent px-3 py-2 text-[13px] font-semibold text-primary transition active:bg-primary/5"
            >
              + Add more
            </button>
          </div>
        </section>

        <div className="h-28" aria-hidden />
      </div>

      <div className="sticky bottom-0 z-20 border-t border-black/[0.06] bg-canvas/95 px-5 py-3 backdrop-blur-md supports-[backdrop-filter]:bg-canvas/90">
        <div className="mx-auto flex max-w-[430px] items-center gap-3">
          <Link
            href={`/messages/${profile.id}`}
            className="flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-full bg-ink px-5 py-3.5 text-[15px] font-bold text-white shadow-lg transition active:scale-[0.99]"
          >
            <MessageCircle className="h-5 w-5" strokeWidth={2.25} />
            Say hi
          </Link>
          <motion.button
            type="button"
            aria-pressed={liked}
            aria-label={liked ? "Unlike" : "Like"}
            onClick={() => setLiked((v) => !v)}
            className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border-2 border-ink/10 bg-white text-ink shadow-card transition-colors"
            whileTap={{ scale: 0.92 }}
          >
            <motion.span
              key={liked ? "on" : "off"}
              initial={{ scale: 0.9 }}
              animate={{ scale: liked ? [1, 1.12, 1] : 1 }}
              transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
            >
              <Heart
                className={`h-6 w-6 ${liked ? "fill-accentPink text-accentPink" : "fill-transparent text-ink/70"}`}
                strokeWidth={2}
              />
            </motion.span>
          </motion.button>
        </div>
      </div>
    </div>
  );
}
