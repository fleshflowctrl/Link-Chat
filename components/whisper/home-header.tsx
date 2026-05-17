"use client";

import { CreditsPill } from "@/components/ui/credits-pill";
import { ProfileStrengthPill } from "@/components/whisper/profile-strength-pill";
import type { EditProfileState } from "@/data/me-edit";
import { SITE_HEADER } from "@/lib/brand";

/**
 * Discover page header. Shows the brand mark on the left, with the credits
 * pill and an optional profile-completeness pill on the right. The latter is
 * only rendered when a signed-in profile is supplied AND it isn't 100% done —
 * the pill component itself decides on visibility.
 */
export function HomeHeader({
  profile,
}: {
  profile?: EditProfileState | null;
}) {
  return (
    <header className="flex items-start justify-between gap-3 px-5 pb-1 pt-[max(1rem,env(safe-area-inset-top))]">
      <h1 className="font-display text-[2rem] font-semibold leading-none tracking-tight text-ink lowercase">
        {SITE_HEADER}
      </h1>
      <div className="flex shrink-0 items-center gap-1.5">
        {profile && <ProfileStrengthPill profile={profile} />}
        <CreditsPill />
      </div>
    </header>
  );
}
