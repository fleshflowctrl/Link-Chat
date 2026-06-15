"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { Profile } from "@/data/profiles";
import {
  getDiscoveryPreferencesSnapshot,
  refreshDiscoveryPreferencesFromServer,
  subscribeDiscoveryPreferences,
} from "@/lib/discovery-preferences-store";
import { WHISPER_DISCOVERY_PREFS_REFETCH } from "@/lib/session-sync";
import { sortProfilesForPreferences } from "@/lib/personalize-feed";
import { ProfileGrid } from "./profile-grid";

export function PersonalizedProfileGrid({
  profiles,
  primaryAction = "profile",
  initialViewerIsPermanent = false,
}: {
  profiles: Profile[];
  primaryAction?: "profile" | "chat";
  initialViewerIsPermanent?: boolean;
}) {
  const prefs = useSyncExternalStore(
    subscribeDiscoveryPreferences,
    getDiscoveryPreferencesSnapshot,
    getDiscoveryPreferencesSnapshot,
  );

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

  return (
    <ProfileGrid
      profiles={sorted}
      primaryAction={primaryAction}
      initialViewerIsPermanent={initialViewerIsPermanent}
    />
  );
}
