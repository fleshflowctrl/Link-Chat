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
  /**
   * SSR-resolved profile for the signed-in user. `null` for guests.
   * Used to pick — at first paint — between the activity strip and the
   * profile-completion nudge so users never see one flash before the other.
   */
  initialProfile: EditProfileState | null;
};

export function HomeScreen({
  gridProfiles,
  activityUsers,
  catalogDegraded,
  initialProfile,
}: Props) {
  const [profile, setProfile] = useState<EditProfileState | null>(initialProfile);

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
