"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import type { NewWhisperUser } from "@/data/newUsers";
import type { Profile } from "@/data/profiles";
import type { EditProfileState } from "@/data/me-edit";
import { hasProfileBasics } from "@/lib/me/profile-completeness";
import { ActivityStrip } from "./activity-strip";
import { CatalogFallbackBanner } from "./catalog-fallback-banner";
import { HomeHeader } from "./home-header";
import { PersonalizedProfileGrid } from "./personalized-profile-grid";
import { ProfileStrengthBanner } from "./profile-strength-banner";

type Props = {
  gridProfiles: Profile[];
  activityUsers: NewWhisperUser[];
  credits?: number;
  catalogDegraded: boolean;
};

/**
 * Status of the signed-in user's profile.
 *  - "loading": fetch in flight (default to showing the activity strip so
 *    we don't flash an empty area for the common-case complete profile).
 *  - "guest": no auth / API said no profile → show the strip, never the nudge.
 *  - EditProfileState: signed-in user; we can decide based on basics.
 */
type MeStatus = "loading" | "guest" | EditProfileState;

export function HomeScreen({
  gridProfiles,
  activityUsers,
  catalogDegraded,
}: Props) {
  const [me, setMe] = useState<MeStatus>("loading");

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/me/profile", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { profile?: EditProfileState | null } | null) => {
        if (cancelled) return;
        if (!data || !data.profile) {
          setMe("guest");
        } else {
          setMe(data.profile);
        }
      })
      .catch(() => {
        if (!cancelled) setMe("guest");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isSignedInProfile = me !== "loading" && me !== "guest";
  const basicsMissing =
    isSignedInProfile && !hasProfileBasics(me as EditProfileState);

  // Show the activity strip by default (loading + guests + complete users).
  // Only hide it for signed-in users who are missing photo/name/age.
  const showStrip = !basicsMissing;
  const showNudge = basicsMissing;

  return (
    <>
      <HomeHeader />
      <CatalogFallbackBanner show={catalogDegraded} />
      {showNudge && (
        <ProfileStrengthBanner profile={me as EditProfileState} />
      )}
      {showStrip && <ActivityStrip users={activityUsers} />}
      <section
        className="px-4 pt-4"
        aria-labelledby="home-for-you-heading"
      >
        <div className="flex items-start gap-2.5">
          <Heart
            className="mt-0.5 h-5 w-5 shrink-0 text-primary"
            fill="currentColor"
            strokeWidth={0}
            aria-hidden
          />
          <div className="min-w-0">
            <h2
              id="home-for-you-heading"
              className="text-[17px] font-bold leading-tight tracking-tight text-ink"
            >
              Speciaal voor jou
            </h2>
            <p className="mt-0.5 text-[13px] leading-snug text-inkMuted">
              Geselecteerd op basis van jouw voorkeuren
            </p>
          </div>
        </div>
      </section>
      <PersonalizedProfileGrid profiles={gridProfiles} />
      <div className="h-6 shrink-0" aria-hidden />
    </>
  );
}
