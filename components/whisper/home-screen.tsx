"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { NewWhisperUser } from "@/data/newUsers";
import type { Profile } from "@/data/profiles";
import type { EditProfileState } from "@/data/me-edit";
import { hasProfileBasics } from "@/lib/me/profile-completeness";
import {
  applyServerCreditsUpdate,
  getCreditsSnapshot,
  initCreditsStore,
  subscribeCredits,
} from "@/lib/credits-store";
import { ActivityStrip } from "./activity-strip";
import { CatalogFallbackBanner } from "./catalog-fallback-banner";
import { HomeFeedHeader } from "./home-feed-header";
import { HomeHeader } from "./home-header";
import { PersonalizedProfileGrid } from "./personalized-profile-grid";
import { ProfileStrengthBanner } from "./profile-strength-banner";

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
};

type FeedRefreshResponse = {
  ok: boolean;
  error?: string;
  profiles?: Profile[];
  feedSlot?: number;
  refreshOffset?: number;
  nextRefreshAt?: number;
  refreshCost?: number;
  balance?: number;
  cost?: number;
};

type FeedGetResponse = {
  ok: boolean;
  profiles?: Profile[];
  feedSlot?: number;
  refreshOffset?: number;
  nextRefreshAt?: number;
  refreshCost?: number;
};

export function HomeScreen({
  gridProfiles,
  activityUsers,
  catalogDegraded,
  initialProfile,
  feedSlot,
  nextRefreshAt,
  refreshCost,
}: Props) {
  const [profile, setProfile] = useState<EditProfileState | null>(initialProfile);

  // Hourly-feed state is owned here so the paid-refresh button can swap the
  // grid in place without a page reload.
  const [profilesState, setProfilesState] = useState<Profile[]>(gridProfiles);
  const [slot, setSlot] = useState<number>(feedSlot);
  const [nextAt, setNextAt] = useState<number>(nextRefreshAt);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  useEffect(() => {
    initCreditsStore();
  }, []);

  const creditsSnapshot = useSyncExternalStore(
    subscribeCredits,
    getCreditsSnapshot,
    getCreditsSnapshot,
  );
  // Hide the pay-to-refresh button for guests (no userKey yet).
  const balanceForButton =
    creditsSnapshot.userKey === "guest" ? null : creditsSnapshot.balance;

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

  // Auto-rotate at the natural hour boundary: when the countdown hits zero,
  // pull a fresh slice from the server and reset the timer.
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    function scheduleNext() {
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
      const delay = Math.max(2000, nextAt - Date.now() + 500);
      fetchTimerRef.current = setTimeout(async () => {
        try {
          const res = await fetch("/api/me/home-feed", { cache: "no-store" });
          const json = (await res.json()) as FeedGetResponse;
          if (json.ok && Array.isArray(json.profiles)) {
            setProfilesState(json.profiles);
            if (typeof json.feedSlot === "number") setSlot(json.feedSlot);
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
  }, [nextAt]);

  async function handleRefreshNow() {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshError(null);
    try {
      const res = await fetch("/api/me/home-feed/refresh", { method: "POST" });
      const json = (await res.json()) as FeedRefreshResponse;
      if (!res.ok || !json.ok) {
        if (res.status === 402) {
          setRefreshError("Niet genoeg credits voor een directe refresh.");
        } else {
          setRefreshError(json.error ?? "Vernieuwen mislukt. Probeer opnieuw.");
        }
        return;
      }
      if (Array.isArray(json.profiles)) setProfilesState(json.profiles);
      if (typeof json.feedSlot === "number") setSlot(json.feedSlot);
      if (typeof json.nextRefreshAt === "number") setNextAt(json.nextRefreshAt);
      if (typeof json.balance === "number") {
        applyServerCreditsUpdate(json.balance);
      }
    } catch {
      setRefreshError("Vernieuwen mislukt. Probeer opnieuw.");
    } finally {
      setRefreshing(false);
    }
  }

  // Decision: signed-in users missing photo/name/age see the nudge instead
  // of the social-proof rail. Guests + complete profiles see the rail.
  const basicsMissing = profile !== null && !hasProfileBasics(profile);

  return (
    <>
      <HomeHeader />
      <CatalogFallbackBanner show={catalogDegraded} />
      {basicsMissing ? (
        <ProfileStrengthBanner profile={profile as EditProfileState} />
      ) : (
        <ActivityStrip users={activityUsers} />
      )}
      <HomeFeedHeader
        nextRefreshAt={nextAt}
        refreshCost={refreshCost}
        balance={balanceForButton}
        onRefreshNow={handleRefreshNow}
        refreshing={refreshing}
        error={refreshError}
      />
      <PersonalizedProfileGrid
        key={`feed-${slot}`}
        profiles={profilesState}
      />
      <div className="h-6 shrink-0" aria-hidden />
    </>
  );
}
