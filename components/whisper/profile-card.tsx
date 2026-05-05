"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Heart, MapPin } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Profile, ProfileStatusVariant } from "@/data/profiles";

const SAY_HI_NAV_MS = 650;

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

export function ProfileCard({
  profile,
  onToast,
}: {
  profile: Profile;
  onToast: (message: string) => void;
}) {
  const router = useRouter();
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hiSent, setHiSent] = useState(profile.sayHiSent);
  const [liked, setLiked] = useState(profile.liked);

  useEffect(() => {
    return () => {
      if (navTimerRef.current) clearTimeout(navTimerRef.current);
    };
  }, []);

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
        href={`/profile/${profile.id}`}
        className="absolute inset-0 z-[1] outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-black/30"
        aria-label={`View ${profile.name}'s profile`}
      />

      <div className="pointer-events-none absolute left-3 top-3 z-[2] max-w-[calc(100%-1rem)]">
        <StatusChip status={profile.status} />
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-[2] flex flex-col p-3">
        <div className="pointer-events-none min-w-0">
          <h2 className="text-[18px] font-bold leading-tight text-white">
            {profile.name}, {profile.age}
          </h2>
          <p className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] text-white/85">
            <MapPin
              className="size-3 shrink-0 text-white/80"
              strokeWidth={2.25}
              aria-hidden
            />
            <span className="min-w-0 truncate">
              {profile.distanceKm} km · {profile.bioSnippet}
            </span>
          </p>
        </div>

        <div className="mt-2.5 flex items-center gap-1.5">
          <button
            type="button"
            disabled={hiSent}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (hiSent) return;
              setHiSent(true);
              onToast("Said hi 👋.");
              if (navTimerRef.current) clearTimeout(navTimerRef.current);
              navTimerRef.current = setTimeout(() => {
                navTimerRef.current = null;
                router.push(`/messages/${profile.id}`);
              }, SAY_HI_NAV_MS);
            }}
            className={`flex flex-1 items-center justify-center gap-1 rounded-full py-2 text-[12px] font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 ${
              hiSent
                ? "bg-white/85 text-gray-400"
                : "bg-white text-gray-900"
            }`}
          >
            <span aria-hidden>💬</span>
            {hiSent ? "Sent ✓" : "Say hi"}
          </button>

          <motion.button
            type="button"
            whileTap={{ scale: 0.88 }}
            transition={{ type: "spring", stiffness: 520, damping: 28 }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setLiked((v) => !v);
            }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20 backdrop-blur transition-colors hover:bg-white/25"
            aria-label={liked ? "Unlike" : "Like"}
            aria-pressed={liked}
          >
            <Heart
              className={`h-[18px] w-[18px] text-white ${
                liked ? "fill-white" : "fill-transparent"
              }`}
              strokeWidth={2.4}
            />
          </motion.button>
        </div>
      </div>
    </article>
  );
}
