"use client";

import Link from "next/link";
import { getProfileCompleteness } from "@/lib/me/profile-completeness";
import type { EditProfileState } from "@/data/me-edit";

const RING_SIZE = 32;
const RING_STROKE = 3;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;

function ringColor(percent: number): string {
  if (percent >= 100) return "#22C55E";
  if (percent >= 70) return "#7C5CFF";
  if (percent >= 40) return "#F59E0B";
  return "#F472B6";
}

/**
 * Tiny progress-ring chip for the discover header. Shows the user's profile
 * completeness at a glance and links to /me/edit focused on the next missing
 * field. Renders nothing once the profile is 100% complete to avoid clutter.
 *
 * Icon-only by design so it sits cleanly next to the credits pill on narrow
 * phones — adding a label would push the credits pill against the screen edge.
 */
export function ProfileStrengthPill({
  profile,
}: {
  profile: EditProfileState;
}) {
  const report = getProfileCompleteness(profile);
  if (report.percent >= 100) return null;
  const top = report.nextSteps[0];
  const focus = top?.focus ?? "photo";
  const color = ringColor(report.percent);
  const offset = RING_CIRC * (1 - report.percent / 100);

  return (
    <Link
      href={`/me/edit?focus=${focus}`}
      aria-label={`Profiel ${report.percent}% compleet — maak af`}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-black/[0.06] transition active:scale-95"
    >
      <span
        className="relative shrink-0"
        style={{ width: RING_SIZE, height: RING_SIZE }}
        aria-hidden
      >
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        >
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke="rgba(0,0,0,0.08)"
            strokeWidth={RING_STROKE}
          />
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            fill="none"
            stroke={color}
            strokeWidth={RING_STROKE}
            strokeDasharray={RING_CIRC}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
            style={{ transition: "stroke-dashoffset 480ms ease, stroke 240ms" }}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-extrabold tabular-nums leading-none text-ink">
          {report.percent}%
        </span>
      </span>
    </Link>
  );
}
