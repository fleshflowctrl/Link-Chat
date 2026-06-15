"use client";

import type { Profile } from "@/data/profiles";
import { APP_PAGE_PADDING_X, PROFILE_GRID_CLASS } from "@/lib/responsive-shell";
import {
  isPermanentCreditsUser,
  subscribeCredits,
} from "@/lib/credits-store";
import { isGuestLockedProfilePhoto } from "@/lib/discover/guest-photo-lock";
import { useMemo, useSyncExternalStore } from "react";
import { ProfileCard } from "./profile-card";

export function ProfileGrid({
  profiles,
  primaryAction = "profile",
  initialViewerIsPermanent = false,
}: {
  profiles: Profile[];
  primaryAction?: "profile" | "chat";
  /**
   * SSR-resolved login state. Used as the initial value so guest-locked photos
   * render blurred in the first paint instead of flickering after hydration.
   */
  initialViewerIsPermanent?: boolean;
}) {
  // SSR snapshot matches the server-resolved value so initial markup is stable.
  // After hydration the credits store can promote the viewer (e.g. when login
  // happens elsewhere in the app), which lifts the lock without a reload.
  const loggedIn = useSyncExternalStore(
    subscribeCredits,
    isPermanentCreditsUser,
    () => initialViewerIsPermanent,
  );
  const effectivelyLoggedIn = loggedIn || initialViewerIsPermanent;

  const lockedPhotoIds = useMemo(() => {
    if (effectivelyLoggedIn) return new Set<string>();
    return new Set(
      profiles.filter((p) => isGuestLockedProfilePhoto(p.id)).map((p) => p.id),
    );
  }, [effectivelyLoggedIn, profiles]);

  return (
    <section className={`${APP_PAGE_PADDING_X} pt-3 pb-2`}>
      <div className={PROFILE_GRID_CLASS}>
        {profiles.map((profile) => (
          <ProfileCard
            key={profile.id}
            profile={profile}
            primaryAction={primaryAction}
            photoLocked={lockedPhotoIds.has(profile.id)}
            requiresAuthForMessage={!effectivelyLoggedIn}
          />
        ))}
      </div>
    </section>
  );
}
