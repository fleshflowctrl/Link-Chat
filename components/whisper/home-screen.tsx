"use client";

import { Heart } from "lucide-react";
import type { NewWhisperUser } from "@/data/newUsers";
import type { Profile } from "@/data/profiles";
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

export function HomeScreen({
  gridProfiles,
  activityUsers,
  catalogDegraded,
}: Props) {
  return (
    <>
      <HomeHeader />
      <CatalogFallbackBanner show={catalogDegraded} />
      <ProfileStrengthBanner />
      <ActivityStrip users={activityUsers} />
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
