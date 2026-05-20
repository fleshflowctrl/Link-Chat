"use client";

import { VariantLink as Link } from "@/components/variant-link";
import { useAppVariant } from "@/components/app-variant-provider";
import {
  COMPLETENESS_FIELDS,
  getProfileCompleteness,
  profileCompletionRewardsEnabled,
} from "@/lib/me/profile-completeness";
import type { EditProfileState } from "@/data/me-edit";

/**
 * Profile-completion nudge.
 *
 * Two visual variants:
 *   - default: large hero card (kept for backwards compat / other surfaces).
 *   - compact: slim row used inline under the FeedEndCard end state
 *     where vertical room is tight and we just want a subtle reminder.
 *
 * Visibility decisions live with the parent — this component just renders.
 * Tap → `/me/edit?focus=<top-missing-field>`.
 */
export function ProfileStrengthBanner({
  profile,
  compact = false,
}: {
  profile: EditProfileState;
  /** Slim inline variant — smaller padding, single-row layout. */
  compact?: boolean;
}) {
  const { variant } = useAppVariant();
  const isV2 = variant === "v2";
  const report = getProfileCompleteness(profile);
  const top = report.nextSteps[0];
  if (!top) return null;

  const showRewards = profileCompletionRewardsEnabled(variant);
  const nextReward = showRewards ? top.reward : 0;
  const gradient = isV2
    ? "bg-gradient-to-br from-[#B52B2A] via-[#C93535] to-[#D63B3A]"
    : "bg-gradient-to-br from-[#7C5CFF] via-[#8E6BFF] to-[#B68BFF]";
  const ctaText = isV2 ? "text-[#B52B2A]" : "text-[#7C5CFF]";

  if (compact) {
    return (
      <Link
        href={`/me/edit?focus=${top.focus}`}
        className={`flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-white shadow-md transition active:scale-[0.99] ${gradient}`}
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-base"
          aria-hidden
        >
          {top.emoji}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[13px] font-extrabold">{top.cta}</p>
          <p className="truncate text-[11px] font-bold text-white/90">
            {nextReward > 0
              ? `+${nextReward} gratis credits · ${report.percent}% af`
              : `Vereist · ${report.percent}% af`}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full bg-white px-3 py-1.5 text-[11px] font-extrabold shadow-sm ${ctaText}`}
        >
          Doen ›
        </span>
      </Link>
    );
  }

  return (
    <div className="px-4 pt-3">
      <Link
        href={`/me/edit?focus=${top.focus}`}
        className={`block overflow-hidden rounded-2xl px-4 pb-3.5 pt-3 text-white shadow-lg active:scale-[0.99] ${gradient}`}
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

        <span
          className={`mt-3 flex w-full items-center justify-center rounded-full bg-white py-2 text-[13px] font-extrabold shadow-sm ${ctaText}`}
        >
          Doen ›
        </span>
      </Link>
    </div>
  );
}

// Re-export so call-sites importing only this banner can also list fields.
export { COMPLETENESS_FIELDS };
