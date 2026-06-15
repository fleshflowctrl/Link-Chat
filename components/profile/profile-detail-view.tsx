"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Heart,
  Lock,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Headphones,
  Users,
  Smile,
} from "lucide-react";
import type { Profile, ProfileInterestIcon } from "@/data/profiles";
import { GuestAuthLinks } from "@/components/auth/guest-auth-links";
import { GuestMessageAuthPrompt } from "@/components/auth/guest-message-auth-prompt";
import { useAppVariant } from "@/components/app-variant-provider";
import { withVariantPath } from "@/lib/app-variant";
import {
  isPermanentCreditsUser,
  subscribeCredits,
} from "@/lib/credits-store";
import {
  getGuestPhotoLockMessage,
  isGuestLockedProfilePhoto,
} from "@/lib/discover/guest-photo-lock";
import { getEditProfileUi } from "@/lib/me/edit-profile-styles";

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

export function ProfileDetailView({
  profile,
  initialViewerIsPermanent = false,
}: {
  profile: Profile;
  /**
   * SSR-resolved login state — keeps photo locks consistent on first paint so
   * guests never see the photo before the blur applies.
   */
  initialViewerIsPermanent?: boolean;
}) {
  const router = useRouter();
  const { variant } = useAppVariant();
  const ui = useMemo(() => getEditProfileUi(variant), [variant]);
  const liveLoggedIn = useSyncExternalStore(
    subscribeCredits,
    isPermanentCreditsUser,
    () => initialViewerIsPermanent,
  );
  const loggedIn = liveLoggedIn || initialViewerIsPermanent;
  const photoLocked = !loggedIn && isGuestLockedProfilePhoto(profile.id);
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  const chatHref = withVariantPath(`/messages/${profile.id}`, variant);
  const gallery = profile.gallery.length > 0 ? profile.gallery : [profile.photo];
  const [heroIndex, setHeroIndex] = useState(0);

  const heroSrc = gallery[heroIndex] ?? profile.photo;
  const [heroLoaded, setHeroLoaded] = useState(false);
  const heroStyle = photoLocked
    ? {
        filter: "blur(28px)",
        opacity: heroLoaded ? 0.3 : 0,
        transform: "scale(1.1)",
        transition: "opacity 240ms ease",
      }
    : undefined;
  const thumbStyle = photoLocked
    ? {
        filter: "blur(10px)",
        opacity: 0.35,
        transform: "scale(1.1)",
      }
    : undefined;

  const thumbSlots = useMemo(
    () =>
      gallery.slice(0, 6).map((src, i) => ({
        src,
        index: i,
        overlay: i === 5 && gallery.length > 6 ? `+${gallery.length - 6}` : undefined,
      })),
    [gallery],
  );

  return (
    <div className="pb-4">
      <div
        className="relative aspect-[3/4] max-h-[85vh] w-full overflow-hidden"
        style={{ backgroundColor: photoLocked ? "#1A1A1B" : undefined }}
      >
        <Image
          src={heroSrc}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-contain"
          style={heroStyle}
          onLoad={() => setHeroLoaded(true)}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/50" />

        {photoLocked && (
          <div
            className="absolute inset-0 z-[15] flex items-center justify-center p-6"
            style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
          >
            <p className="flex flex-col items-center gap-2 text-center">
              <Lock className="h-5 w-5 text-[#E85A59]" strokeWidth={2.25} aria-hidden />
              <span className="max-w-[20ch] text-[13px] font-bold leading-snug text-white drop-shadow-sm">
                {getGuestPhotoLockMessage(profile.name)}
              </span>
            </p>
          </div>
        )}

        {/* top bar: back + actions */}
        <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between gap-2 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white shadow-lg ring-1 ring-white/15 backdrop-blur-sm transition active:scale-95"
            aria-label="Terug"
          >
            <ChevronLeft className="h-6 w-6" strokeWidth={2.25} />
          </button>
          {loggedIn ? (
            <button
              type="button"
              onClick={() => console.log("[profile] More options placeholder")}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white shadow-lg ring-1 ring-white/15 backdrop-blur-sm transition active:scale-95"
              aria-label="Meer"
            >
              <MoreHorizontal className="h-5 w-5" strokeWidth={2} />
            </button>
          ) : (
            <div className="rounded-full bg-black/45 px-1 py-1 shadow-lg ring-1 ring-white/15 backdrop-blur-sm">
              <GuestAuthLinks compact onPhoto />
            </div>
          )}
        </div>

        {/* bottom name / city overlay */}
        <div className="absolute bottom-0 left-0 right-0 z-10 p-4 pb-14">
          <div className="mt-2.5 flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="min-w-0 text-[1.9rem] font-bold leading-tight tracking-tight text-white drop-shadow-md">
              {profile.name}, {profile.age}
            </h1>
            {profile.isVerified && (
              <BadgeCheck
                className="h-7 w-7 shrink-0 text-primary drop-shadow-md"
                strokeWidth={2}
                aria-label="Geverifieerd"
              />
            )}
          </div>
          <p className="mt-1.5 flex items-center gap-1.5 text-[13px] font-medium text-white/95 drop-shadow">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-white" strokeWidth={2.25} />
            {profile.city}
          </p>
        </div>
      </div>

      <div className="relative z-10 -mt-5 rounded-t-[1.5rem] bg-canvas px-4 pb-6 pt-4 shadow-[0_-12px_48px_-12px_rgba(0,0,0,0.12)]">
        {/* thumbnail strip */}
        {thumbSlots.length > 1 && (
          <div className="scrollbar-hide -mx-1 mb-4 flex gap-2 overflow-x-auto pb-1 pt-1">
            {thumbSlots.map((slot) => {
              const active = heroIndex === slot.index;
              return (
                <button
                  key={slot.index}
                  type="button"
                  onClick={() => setHeroIndex(slot.index)}
                  className={`relative h-[60px] w-[60px] shrink-0 overflow-hidden rounded-xl ring-2 transition active:scale-95 ${
                    active
                      ? "ring-primary ring-offset-2 ring-offset-canvas"
                      : "opacity-65 ring-transparent"
                  }`}
                >
                  <Image
                    src={slot.src}
                    alt=""
                    width={120}
                    height={120}
                    className="h-full w-full object-cover"
                    style={thumbStyle}
                  />
                  {slot.overlay && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-[12px] font-bold text-white">
                      {slot.overlay}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-4">
          <div className={ui.lookingBtn}>
            <span className={ui.lookingIcon}>
              <Heart className="h-5 w-5" fill="currentColor" strokeWidth={0} />
            </span>
            <div className="min-w-0 flex-1">
              <p className={ui.lookingLabel}>Op zoek naar</p>
              <p className={ui.lookingValueProfile}>{profile.lookingFor}</p>
            </div>
          </div>
        </div>

        <section className="mt-6">
          <h2 className="text-[16px] font-bold text-ink">Over mij</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-inkMuted">
            {profile.bio}
          </p>
        </section>

        <section className="mt-6">
          <h2 className="text-[16px] font-bold text-ink">Interesses</h2>
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
          </div>
        </section>

        <div className="h-20" aria-hidden />
      </div>

      <div className={ui.sayHelloBar}>
        {loggedIn ? (
          <Link href={chatHref} className={ui.sayHelloBtn}>
            <MessageCircle className="h-5 w-5" strokeWidth={2.25} />
            Zeg hallo
          </Link>
        ) : (
          <button
            type="button"
            className={ui.sayHelloBtn}
            onClick={() => setAuthPromptOpen(true)}
          >
            <MessageCircle className="h-5 w-5" strokeWidth={2.25} />
            Zeg hallo
          </button>
        )}
      </div>

      <GuestMessageAuthPrompt
        open={authPromptOpen}
        onClose={() => setAuthPromptOpen(false)}
        returnPath={chatHref}
        profileName={profile.name}
      />
    </div>
  );
}
