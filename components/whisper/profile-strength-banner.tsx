"use client";

import Link from "next/link";
import {
  COMPLETENESS_FIELDS,
  getProfileCompleteness,
} from "@/lib/me/profile-completeness";
import type { EditProfileState } from "@/data/me-edit";

/**
 * Slim nudge that replaces the "Nieuw op whisper" rail on /discover when
 * the signed-in user is still missing the profile basics (photo, name, age).
 *
 * The visibility decision lives in the parent (HomeScreen) — this component
 * just renders. Tap → /me/edit?focus=<top-missing-field>.
 */
export function ProfileStrengthBanner({
  profile,
}: {
  profile: EditProfileState;
}) {
  const report = getProfileCompleteness(profile);
  const top = report.nextSteps[0];
  if (!top) return null;

  // Reward earned by doing JUST the next step — concrete "you'll get X
  // credits right now" promise rather than the abstract total.
  const nextReward = top.reward;

  return (
    <div className="px-4 pt-3">
      <Link
        href={`/me/edit?focus=${top.focus}`}
        className="block overflow-hidden rounded-2xl bg-gradient-to-br from-[#7C5CFF] via-[#8E6BFF] to-[#B68BFF] px-4 pb-3.5 pt-3 text-white shadow-lg active:scale-[0.99]"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-base"
              aria-hidden
            >
              {top.emoji}
            </span>
            <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-white/80">
              Profiel afmaken
            </span>
          </div>
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-extrabold tabular-nums text-white">
            {report.percent}%
          </span>
        </div>

        <p className="mt-2 text-[15px] font-extrabold leading-snug">
          {top.cta}
        </p>

        {nextReward > 0 ? (
          <p className="mt-1 text-[12px] font-bold leading-tight text-white/95">
            +{nextReward} gratis credits voor deze stap
          </p>
        ) : (
          <p className="mt-1 text-[12px] font-bold leading-tight text-white/95">
            Vereist om gevonden te worden
          </p>
        )}

        <span className="mt-3 flex w-full items-center justify-center rounded-full bg-white py-2 text-[13px] font-extrabold text-[#7C5CFF] shadow-sm">
          Doen ›
        </span>
      </Link>
    </div>
  );
}

// Re-export so call-sites importing only this banner can also list fields.
export { COMPLETENESS_FIELDS };
