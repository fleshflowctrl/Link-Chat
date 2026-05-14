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

  return (
    <div className="px-4 pt-3">
      <div className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#7C5CFF] to-[#9B7BFF] px-4 py-3 text-white shadow-md">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-base"
          aria-hidden
        >
          {top.emoji}
        </span>
        <Link href={`/me/edit?focus=${top.focus}`} className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-extrabold leading-tight">
            {top.cta}
          </p>
          <p className="mt-0.5 truncate text-[11px] font-medium text-white/85">
            Profielsterkte {report.percent}%
            {stillOnTable > 0 && (
              <>
                {" "}
                · verdien <span className="font-bold">{stillOnTable} credits</span>
              </>
            )}
          </p>
        </Link>
        <Link
          href={`/me/edit?focus=${top.focus}`}
          className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[11px] font-extrabold text-[#7C5CFF] shadow-sm active:scale-95"
        >
          Doen
        </Link>
      </div>
    </div>
  );
}

// Re-export so call-sites importing only this banner can also list fields.
export { COMPLETENESS_FIELDS };
