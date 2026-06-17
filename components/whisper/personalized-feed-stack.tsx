"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { Profile } from "@/data/profiles";
import type { EditProfileState } from "@/data/me-edit";
import {
  getDiscoveryPreferencesSnapshot,
  refreshDiscoveryPreferencesFromServer,
  subscribeDiscoveryPreferences,
} from "@/lib/discovery-preferences-store";
import { WHISPER_DISCOVERY_PREFS_REFETCH } from "@/lib/session-sync";
import { sortProfilesForPreferences } from "@/lib/personalize-feed";
import { isGuestLockedProfilePhoto } from "@/lib/discover/guest-photo-lock";
import {
  isPermanentCreditsUser,
  subscribeCredits,
} from "@/lib/credits-store";
import { FeedStack } from "./feed-stack";

type Props = {
  profiles: Profile[];
  feedSlot: number;
  feedHash: string;
  nextRefreshAt: number;
  refreshCost: number;
  balance: number | null;
  onRefreshNow: () => void | Promise<void>;
  refreshing: boolean;
  refreshError: string | null;
  profile?: EditProfileState | null;
  compact?: boolean;
  startAtProfileId?: string | null;
  initialViewerIsPermanent?: boolean;
};

export function PersonalizedFeedStack({
  profiles,
  initialViewerIsPermanent = false,
  ...stackProps
}: Props) {
  const prefs = useSyncExternalStore(
    subscribeDiscoveryPreferences,
    getDiscoveryPreferencesSnapshot,
    getDiscoveryPreferencesSnapshot,
  );

  const loggedIn = useSyncExternalStore(
    subscribeCredits,
    isPermanentCreditsUser,
    () => initialViewerIsPermanent,
  );
  const effectivelyLoggedIn = loggedIn || initialViewerIsPermanent;

  useEffect(() => {
    void refreshDiscoveryPreferencesFromServer();
    const onRefetch = () => void refreshDiscoveryPreferencesFromServer();
    window.addEventListener(WHISPER_DISCOVERY_PREFS_REFETCH, onRefetch);
    return () =>
      window.removeEventListener(WHISPER_DISCOVERY_PREFS_REFETCH, onRefetch);
  }, []);

  const sorted = useMemo(
    () => sortProfilesForPreferences(profiles, prefs),
    [profiles, prefs],
  );

  const lockedPhotoIds = useMemo(() => {
    if (effectivelyLoggedIn) return new Set<string>();
    return new Set(
      sorted.filter((p) => isGuestLockedProfilePhoto(p.id)).map((p) => p.id),
    );
  }, [effectivelyLoggedIn, sorted]);

  return (
    <FeedStack
      {...stackProps}
      profiles={sorted}
      lockedPhotoIds={lockedPhotoIds}
      requiresAuthForMessage={!effectivelyLoggedIn}
    />
  );
}
