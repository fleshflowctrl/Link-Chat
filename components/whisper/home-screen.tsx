"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { NewWhisperUser } from "@/data/newUsers";
import type { Profile } from "@/data/profiles";
import type { EditProfileState } from "@/data/me-edit";
import {
  applyServerCreditsUpdate,
  getCreditsSnapshot,
  initCreditsStore,
  isPermanentCreditsUser,
  subscribeCredits,
} from "@/lib/credits-store";
import {
  discoveryPreferencesLoaded,
  refreshDiscoveryPreferencesFromServer,
  subscribeDiscoveryPreferences,
} from "@/lib/discovery-preferences-store";
import {
  consumeFunnelPickedPeerClient,
  pinProfileFirstInFeed,
} from "@/lib/catalog/funnel-picked-peer";
import { hashFeedComposition } from "@/lib/catalog/hourly-feed";
import { preloadProfilePhotosAround, preloadProfilePhotosIdle } from "@/lib/discover/preload-profile-photos";
import { ensureGuestSession } from "@/lib/auth/guest-session";
import { appVariantFetchHeaders } from "@/lib/app-variant";
import { CatalogFallbackBanner } from "./catalog-fallback-banner";
import { PersonalizedFeedStack } from "./personalized-feed-stack";
import { HomeHeader } from "./home-header";

type Props = {
  gridProfiles: Profile[];
  activityUsers: NewWhisperUser[];
  credits?: number;
  catalogDegraded: boolean;
  /**
   * SSR-resolved profile for the signed-in user. `null` for guests.
   * Used to pick — at first paint — between the activity strip and the
   * profile-completion nudge so users never see one flash before the other.
   */
  initialProfile: EditProfileState | null;
  /** Active hourly feed slot (current hour + paid refresh offset). */
  feedSlot: number;
  /** Epoch-ms of the next natural hourly rotation. */
  nextRefreshAt: number;
  /** Credit cost to skip ahead to the next slot now. */
  refreshCost: number;
  /** Stable hash of the resulting ordered profile ids — used as the cursor key. */
  feedHash: string;
  /** Fit header + feed in viewport without page scroll. */
  fitViewport?: boolean;
  /** SSR-resolved: true when the request comes from a permanent (logged-in) account. */
  initialViewerIsPermanent?: boolean;
};

type FeedGetResponse = {
  ok: boolean;
  profiles?: Profile[];
  feedSlot?: number;
  refreshOffset?: number;
  nextRefreshAt?: number;
  refreshCost?: number;
  feedHash?: string;
};

export function HomeScreen({
  gridProfiles,
  activityUsers,
  catalogDegraded,
  initialProfile,
  feedSlot,
  nextRefreshAt,
  refreshCost,
  feedHash,
  fitViewport = false,
  initialViewerIsPermanent = false,
}: Props) {
  const [profile, setProfile] = useState<EditProfileState | null>(initialProfile);

  // Hourly-feed state is owned here so the paid-refresh button can swap the
  // grid in place without a page reload.
  const [profilesState, setProfilesState] = useState<Profile[]>(gridProfiles);
  const [slot, setSlot] = useState<number>(feedSlot);
  const [nextAt, setNextAt] = useState<number>(nextRefreshAt);
  const [hash, setHash] = useState<string>(feedHash);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [funnelStartId, setFunnelStartId] = useState<string | null>(null);

  const balance = useSyncExternalStore(
    subscribeCredits,
    () => getCreditsSnapshot().balance,
    () => null,
  );

  const viewerIsPermanent = useSyncExternalStore(
    subscribeCredits,
    isPermanentCreditsUser,
    () => initialViewerIsPermanent,
  );

  // Hold the feed behind a loader until preferences have settled (preferences
  // loaded + any client refetch resolved). This prevents the initial SSR set
  // from being visibly re-sorted/replaced a beat later — which briefly exposed
  // profile photos that should stay blurred for guests.
  const prefsLoaded = useSyncExternalStore(
    subscribeDiscoveryPreferences,
    discoveryPreferencesLoaded,
    () => false,
  );
  const [maxWaitElapsed, setMaxWaitElapsed] = useState(false);
  const hasProfiles = profilesState.length > 0;
  const feedReady = (hasProfiles && prefsLoaded) || maxWaitElapsed;

  useEffect(() => {
    // Safety valve: never keep the loader up forever if a sync call stalls.
    const t = setTimeout(() => setMaxWaitElapsed(true), 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    initCreditsStore();
    void refreshDiscoveryPreferencesFromServer();
  }, []);

  // Start decoding feed photos as soon as the pack is known — before the
  // preferences gate lifts and before the user sees the first card.
  useLayoutEffect(() => {
    if (profilesState.length === 0) return;
    preloadProfilePhotosAround(profilesState, 0, 10, 0);
    preloadProfilePhotosIdle(profilesState.map((p) => p.photo));
  }, [profilesState]);

  useLayoutEffect(() => {
    if (gridProfiles.length === 0) return;
    preloadProfilePhotosAround(gridProfiles, 0, 10, 0);
  }, [gridProfiles]);

  // Guest session for chat/credits runs in SessionSyncProvider. Fallback client
  // feed fetch only if SSR returned an empty pack (e.g. Supabase misconfigured).
  useEffect(() => {
    if (gridProfiles.length > 0) return;
    let cancelled = false;
    void (async () => {
      try {
        await ensureGuestSession();
        const res = await fetch("/api/me/home-feed", {
          cache: "no-store",
          headers: appVariantFetchHeaders(),
        });
        const json = (await res.json()) as FeedGetResponse;
        if (cancelled || !json.ok || !Array.isArray(json.profiles)) return;
        if (json.profiles.length > 0) {
          setProfilesState(json.profiles);
          if (typeof json.feedSlot === "number") setSlot(json.feedSlot);
          if (typeof json.feedHash === "string") setHash(json.feedHash);
          if (typeof json.nextRefreshAt === "number") setNextAt(json.nextRefreshAt);
        }
      } catch {
        /* keep empty state */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [gridProfiles.length]);

  // After onboarding "Dit is mijn type", show that profile first (SSR may
  // already have reordered; this covers guests and any race with the cookie).
  useEffect(() => {
    const pickedId = consumeFunnelPickedPeerClient();
    if (!pickedId) return;
    setFunnelStartId(pickedId);
    setProfilesState((prev) => {
      const next = pinProfileFirstInFeed(prev, prev, pickedId);
      if (next[0]?.id === pickedId) {
        setHash(hashFeedComposition(next.map((p) => p.id)));
      }
      return next;
    });
  }, []);

  /**
   * Re-sync after mount: the user might have just edited their profile and
   * navigated back. Only updates state if we still get a profile back; we
   * never overwrite a SSR profile with `null` here so guests stay guests
   * and signed-in users don't blink to "guest" on a transient API hiccup.
   */
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/me/profile", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { profile?: EditProfileState | null } | null) => {
        if (cancelled || !data?.profile) return;
        setProfile(data.profile);
      })
      .catch(() => {
        /* keep SSR value */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-rotate at the natural hour boundary for signed-in users only.
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!viewerIsPermanent) return;

    function scheduleNext() {
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
      const delay = Math.max(2000, nextAt - Date.now() + 500);
      fetchTimerRef.current = setTimeout(async () => {
        try {
          const res = await fetch("/api/me/home-feed", {
            cache: "no-store",
            headers: appVariantFetchHeaders(),
          });
          const json = (await res.json()) as FeedGetResponse;
          if (json.ok && Array.isArray(json.profiles)) {
            setProfilesState(json.profiles);
            if (typeof json.feedSlot === "number") setSlot(json.feedSlot);
            if (typeof json.feedHash === "string") setHash(json.feedHash);
            if (typeof json.nextRefreshAt === "number") {
              setNextAt(json.nextRefreshAt);
            } else {
              setNextAt(Date.now() + 60 * 60 * 1000);
            }
          } else {
            // On failure, just push the timer ahead an hour so we don't loop.
            setNextAt(Date.now() + 60 * 60 * 1000);
          }
        } catch {
          setNextAt(Date.now() + 60 * 60 * 1000);
        }
      }, delay);
    }
    scheduleNext();
    return () => {
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
    };
  }, [nextAt, viewerIsPermanent]);

  const handleRefreshNow = useCallback(async () => {
    setRefreshing(true);
    setRefreshError(null);
    try {
      const res = await fetch("/api/me/home-feed/refresh", {
        method: "POST",
        cache: "no-store",
        headers: appVariantFetchHeaders(),
      });
      const json = (await res.json()) as FeedGetResponse & {
        ok?: boolean;
        error?: string;
        balance?: number;
      };
      if (!res.ok || !json.ok) {
        setRefreshError(
          json.error === "insufficient credits"
            ? "Niet genoeg berichten in je bundel voor een nieuwe ronde."
            : (json.error ?? "Vernieuwen mislukt"),
        );
        return;
      }
      if (Array.isArray(json.profiles)) {
        setProfilesState(json.profiles);
      }
      if (typeof json.feedSlot === "number") setSlot(json.feedSlot);
      if (typeof json.feedHash === "string") setHash(json.feedHash);
      if (typeof json.nextRefreshAt === "number") setNextAt(json.nextRefreshAt);
      if (typeof json.balance === "number") {
        applyServerCreditsUpdate(json.balance);
      }
    } catch {
      setRefreshError("Vernieuwen mislukt — probeer opnieuw.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  return (
    <div
      className={
        fitViewport
          ? "flex min-h-0 flex-1 flex-col overflow-hidden"
          : "flex h-full min-h-0 flex-col"
      }
    >
      <HomeHeader profile={profile} compact={fitViewport} />
      <CatalogFallbackBanner show={catalogDegraded} compact={fitViewport} />
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {!feedReady && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-canvas">
            <span
              className="h-7 w-7 animate-spin rounded-full border-2 border-[#B52B2A]/30 border-t-[#B52B2A]"
              aria-label="Laden"
            />
          </div>
        )}
        <div
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          style={{
            opacity: feedReady ? 1 : 0,
            transition: "opacity 200ms ease",
          }}
          aria-hidden={!feedReady}
        >
          <PersonalizedFeedStack
            key={`${slot}:${hash}`}
            profiles={profilesState}
            feedSlot={slot}
            feedHash={hash}
            nextRefreshAt={nextAt}
            refreshCost={refreshCost}
            balance={balance}
            onRefreshNow={handleRefreshNow}
            refreshing={refreshing}
            refreshError={refreshError}
            profile={profile}
            compact={fitViewport}
            startAtProfileId={funnelStartId}
            initialViewerIsPermanent={initialViewerIsPermanent}
          />
        </div>
      </div>
    </div>
  );
}
