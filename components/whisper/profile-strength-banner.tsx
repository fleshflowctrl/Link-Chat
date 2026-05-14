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

  // Total credits the user can still earn by completing remaining fields.
  const stillOnTable = report.nextSteps.reduce(
    (sum, f) => sum + f.reward,
    0,
  );

  // Reward earned by doing JUST the next step — gives a concrete "you'll get
  // X credits right now" promise instead of the abstract total.
  const nextReward = top.reward;

  return (
    <div className="px-4 pt-3">
      <Link
        href={`/me/edit?focus=${top.focus}`}
        className="block overflow-hidden rounded-2xl bg-gradient-to-br from-[#7C5CFF] via-[#8E6BFF] to-[#B68BFF] px-4 pb-4 pt-3.5 text-white shadow-lg active:scale-[0.99]"
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

        <p className="mt-2.5 text-[16px] font-extrabold leading-snug">
          {top.cta}
        </p>

        {/* Progress bar — visual cue of how close to "complete" they are. */}
        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-white transition-[width] duration-500"
            style={{ width: `${Math.max(4, report.percent)}%` }}
          />
        </div>

        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            {nextReward > 0 ? (
              <p className="text-[12px] font-bold leading-tight text-white/95">
                +{nextReward} gratis credits voor deze stap
              </p>
            ) : (
              <p className="text-[12px] font-bold leading-tight text-white/95">
                Vereist om gevonden te worden
              </p>
            )}
            {stillOnTable > nextReward && (
              <p className="mt-0.5 text-[11px] font-medium text-white/75">
                Totaal nog{" "}
                <span className="font-bold text-white">
                  {stillOnTable} credits
                </span>{" "}
                te verdienen
              </p>
            )}
          </div>
          <span className="shrink-0 rounded-full bg-white px-4 py-2 text-[12px] font-extrabold text-[#7C5CFF] shadow-sm">
            Doen ›
          </span>
        </div>
      </Link>
    </div>
  );
}

// Re-export so call-sites importing only this banner can also list fields.
export { COMPLETENESS_FIELDS };
