"use client";

import { homeGridProfiles } from "@/data/profiles";
import { ProfileCard } from "./profile-card";

export function ProfileGrid() {
  return (
    <section className="px-5 pt-7">
      <div className="grid grid-cols-2 gap-3">
        {homeGridProfiles.map((profile) => (
          <ProfileCard key={profile.id} profile={profile} />
        ))}
      </div>
    </section>
  );
}
