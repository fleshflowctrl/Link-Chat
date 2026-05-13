"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { WHISPER_USER_KEY } from "@/data/funnel";
import type { NewWhisperUser } from "@/data/newUsers";
import type { Profile } from "@/data/profiles";
import { ActivityStrip } from "./activity-strip";
import { CatalogFallbackBanner } from "./catalog-fallback-banner";
import { HomeHeader } from "./home-header";
import { PersonalizedProfileGrid } from "./personalized-profile-grid";

type Props = {
  gridProfiles: Profile[];
  activityUsers: NewWhisperUser[];
  credits: number;
  catalogDegraded: boolean;
};

export function HomeScreen({
  gridProfiles,
  activityUsers,
  credits: serverCredits,
  catalogDegraded,
}: Props) {
  const [credits, setCredits] = useState(serverCredits);

  useEffect(() => {
    setCredits(serverCredits);
  }, [serverCredits]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(WHISPER_USER_KEY);
      if (!raw) return;
      const o = JSON.parse(raw) as { credits?: unknown };
      if (typeof o.credits === "number" && o.credits >= 0) {
        setCredits(o.credits);
      }
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <>
      <HomeHeader credits={credits} />
      <CatalogFallbackBanner show={catalogDegraded} />
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
