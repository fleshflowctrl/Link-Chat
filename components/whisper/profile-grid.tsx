"use client";

import type { Profile } from "@/data/profiles";
import { APP_PAGE_PADDING_X, PROFILE_GRID_CLASS } from "@/lib/responsive-shell";
import { ProfileCard } from "./profile-card";

export function ProfileGrid({
  profiles,
  primaryAction = "profile",
}: {
  profiles: Profile[];
  primaryAction?: "profile" | "chat";
}) {
  return (
    <section className={`${APP_PAGE_PADDING_X} pt-3 pb-2`}>
      <div className={PROFILE_GRID_CLASS}>
        {profiles.map((profile) => (
          <ProfileCard
            key={profile.id}
            profile={profile}
            primaryAction={primaryAction}
          />
        ))}
      </div>
    </section>
  );
}
