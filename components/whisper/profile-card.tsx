"use client";

import Image from "next/image";
import { VariantLink as Link } from "@/components/variant-link";
import { useAppVariant } from "@/components/app-variant-provider";
import { withVariantPath } from "@/lib/app-variant";
import { postProfileSeen } from "@/lib/catalog/post-profile-seen";
import { GuestMessageAuthPrompt } from "@/components/auth/guest-message-auth-prompt";
import { getGuestPhotoLockMessage } from "@/lib/discover/guest-photo-lock";
import { ArrowRight, Lock, MapPin, MessageCircle } from "lucide-react";
import { type ReactNode, useState } from "react";
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

  const showDot = variant === "active" || variant === "online";

  return (
    <span className={statusChipClasses(variant)}>
      {showDot && dot}
      {prefix}
      <span>{label}</span>
    </span>
  );
}

export function ProfileCard({
  profile,
  primaryAction = "profile",
  photoLocked = false,
  requiresAuthForMessage = false,
}: {
  profile: Profile;
  primaryAction?: "profile" | "chat";
  /** Guest teaser — blurred photo until permanent login. */
  photoLocked?: boolean;
  /** Guests must log in before starting a chat. */
  requiresAuthForMessage?: boolean;
}) {
  const { variant } = useAppVariant();
  const isV2 = variant === "v2";
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  const profileHref = withVariantPath(`/profile/${profile.id}`, variant);
  const chatHref = withVariantPath(`/messages/${profile.id}`, variant);
  const chatFirst = primaryAction === "chat";

  const cardBase =
    "w-full overflow-hidden rounded-2xl shadow-sm outline-none transition active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-offset-2 " +
    (isV2
      ? "bg-[#2A2A2B] ring-1 ring-[#B52B2A]/20 focus-visible:ring-[#B52B2A]"
      : "bg-white ring-black/5 focus-visible:ring-gray-900");

  const [photoLoaded, setPhotoLoaded] = useState(false);
  const photoBlock = (
    <div
      className="relative aspect-[4/5] w-full overflow-hidden"
      style={photoLocked ? { backgroundColor: "#1A1A1B" } : undefined}
    >
      <Image
        src={profile.photo}
        alt=""
        fill
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 220px"
        className="object-cover"
        style={
          photoLocked
            ? {
                filter: "blur(24px)",
                opacity: photoLoaded ? 0.3 : 0,
                transform: "scale(1.1)",
                transition: "opacity 220ms ease",
              }
            : undefined
        }
        onLoad={() => setPhotoLoaded(true)}
        priority={profile.id === "maya" || profile.id === "marcus"}
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent"
        aria-hidden
      />

      {photoLocked && (
        <div
          className="absolute inset-0 z-[2] flex items-center justify-center p-3"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
        >
          <p className="flex flex-col items-center gap-1.5 text-center">
            <Lock
              className={`h-4 w-4 ${isV2 ? "text-[#E85A59]" : "text-white"}`}
              strokeWidth={2.25}
              aria-hidden
            />
            <span className="text-[10px] font-bold leading-snug text-white drop-shadow-sm">
              {getGuestPhotoLockMessage(profile.name)}
            </span>
          </p>
        </div>
      )}

      {profile.status.label.trim().length > 0 && (
        <div className="absolute left-3 top-3 z-[1] max-w-[calc(100%-1.5rem)]">
          <StatusChip status={profile.status} />
        </div>
      )}

      <div className="pointer-events-none absolute bottom-2 left-2.5 right-2.5 z-[1]">
        <p className="truncate text-[15px] font-extrabold leading-tight text-white">
          {profile.name}, {profile.age}
        </p>
      </div>
    </div>
  );

  const metaBlock = (
    <>
      <div
        className={`flex items-center gap-1 text-[11px] ${isV2 ? "text-[#9B9B9B]" : "text-gray-500"}`}
      >
        <MapPin className="size-3 shrink-0" strokeWidth={2.25} aria-hidden />
        <span className="truncate">{profile.city}</span>
      </div>
      <p
        className={`mt-1 line-clamp-2 text-[11px] leading-snug ${isV2 ? "text-[#C8C8C8]" : "text-gray-700"}`}
      >
        {profile.bio}
      </p>
    </>
  );

  const profileButtonClass = `mt-2.5 flex w-full min-h-[48px] items-center justify-center gap-2 rounded-full py-3 text-[15px] font-bold transition active:scale-[0.98] ${
    isV2
      ? "bg-[#353536] text-white ring-1 ring-[#B52B2A]/30"
      : "bg-gray-100 text-gray-900 ring-1 ring-black/10"
  }`;

  const chatButtonClass = `flex w-full min-h-[48px] items-center justify-center gap-2 rounded-full py-3 text-[15px] font-bold text-white transition active:scale-[0.98] ${
    isV2 ? "bg-[#B52B2A]" : "bg-gray-900"
  }`;

  if (chatFirst) {
    return (
      <article className={cardBase}>
        <Link
          href={profileHref}
          className="block outline-none focus-visible:ring-2 focus-visible:ring-[#B52B2A] focus-visible:ring-offset-2"
          aria-label={`Profiel van ${profile.name} bekijken`}
          onClick={() => postProfileSeen(profile.id)}
        >
          {photoBlock}
        </Link>
        <div className="p-3">
          {metaBlock}
          <Link
            href={profileHref}
            className={profileButtonClass}
            onClick={() => postProfileSeen(profile.id)}
          >
            Bekijk profiel
            <ArrowRight className="size-[18px] shrink-0" strokeWidth={2.5} aria-hidden />
          </Link>
          {requiresAuthForMessage ? (
            <button
              type="button"
              className={`${chatButtonClass} mt-2`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setAuthPromptOpen(true);
              }}
            >
              <MessageCircle className="size-[18px] shrink-0" strokeWidth={2.5} aria-hidden />
              Stuur bericht
            </button>
          ) : (
            <Link
              href={chatHref}
              className={`${chatButtonClass} mt-2`}
              onClick={() => postProfileSeen(profile.id)}
            >
              <MessageCircle className="size-[18px] shrink-0" strokeWidth={2.5} aria-hidden />
              Stuur bericht
            </Link>
          )}
        </div>
        <GuestMessageAuthPrompt
          open={authPromptOpen}
          onClose={() => setAuthPromptOpen(false)}
          returnPath={chatHref}
          profileName={profile.name}
        />
      </article>
    );
  }

  return (
    <Link
      href={profileHref}
      className={`block ${cardBase}`}
      aria-label={`Profiel van ${profile.name} bekijken`}
    >
      {photoBlock}
      <div className="p-3">
        {metaBlock}
        <div className={`${chatButtonClass} mt-2.5`}>
          Bekijken
          <ArrowRight className="size-[18px] shrink-0" strokeWidth={2.5} aria-hidden />
        </div>
      </div>
    </Link>
  );
}
