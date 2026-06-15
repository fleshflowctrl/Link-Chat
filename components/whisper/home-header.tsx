"use client";

import { GuestAuthLinks } from "@/components/auth/guest-auth-links";
import { CreditsPill } from "@/components/ui/credits-pill";
import { ProfileStrengthPill } from "@/components/whisper/profile-strength-pill";
import type { EditProfileState } from "@/data/me-edit";
import { SITE_DISPLAY } from "@/lib/brand";
import { APP_PAGE_PADDING_X } from "@/lib/responsive-shell";
import {
  isPermanentCreditsUser,
  subscribeCredits,
} from "@/lib/credits-store";
import { useSyncExternalStore } from "react";

/**
 * Discover page header. Shows the brand mark on the left, with the credits
 * pill and an optional profile-completeness pill on the right. The latter is
 * only rendered when a signed-in profile is supplied AND it isn't 100% done —
 * the pill component itself decides on visibility.
 */
export function HomeHeader({
  profile,
  compact = false,
}: {
  profile?: EditProfileState | null;
  compact?: boolean;
}) {
  const loggedIn = useSyncExternalStore(
    subscribeCredits,
    isPermanentCreditsUser,
    () => false,
  );

  return (
    <header
      className={
        compact
          ? `flex shrink-0 items-center justify-between gap-2 pb-2.5 pt-[max(0.85rem,env(safe-area-inset-top))] ${APP_PAGE_PADDING_X}`
          : `flex items-start justify-between gap-3 pb-2.5 pt-[max(1.25rem,env(safe-area-inset-top))] ${APP_PAGE_PADDING_X}`
      }
    >
      <h1
        className={
          compact
            ? "font-display text-[1.25rem] font-semibold leading-none tracking-tight text-ink"
            : "font-display text-[1.5rem] font-semibold leading-none tracking-tight text-ink"
        }
      >
        {SITE_DISPLAY}
      </h1>
      <div className="flex shrink-0 items-center gap-1.5">
        {loggedIn ? (
          <>
            {profile && <ProfileStrengthPill profile={profile} />}
            <CreditsPill />
          </>
        ) : (
          <GuestAuthLinks compact={compact} />
        )}
      </div>
    </header>
  );
}
