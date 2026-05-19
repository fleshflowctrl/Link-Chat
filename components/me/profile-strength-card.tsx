"use client";

import Link from "next/link";
import { VariantLink } from "@/components/variant-link";
import {
  COMPLETENESS_FIELDS,
  TOTAL_PROFILE_REWARD_CREDITS,
  getProfileCompleteness,
  type CompletenessField,
  type CompletenessFieldMeta,
} from "@/lib/me/profile-completeness";
import type { EditProfileState } from "@/data/me-edit";

const RING_SIZE = 56;
const RING_STROKE = 5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;

function ringColor(percent: number): string {
  if (percent >= 100) return "#22C55E"; // green-500
  if (percent >= 70) return "#7C5CFF"; // primary
  if (percent >= 40) return "#F59E0B"; // amber-500
  return "#F472B6"; // pink-400
}

function ProgressRing({ percent }: { percent: number }) {
  const safe = Math.max(0, Math.min(100, percent));
  const offset = RING_CIRC * (1 - safe / 100);
  const color = ringColor(safe);
  return (
    <div
      className="relative shrink-0"
      style={{ width: RING_SIZE, height: RING_SIZE }}
    >
      <svg
        width={RING_SIZE}
        height={RING_SIZE}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        aria-hidden
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
      <div className="absolute inset-0 flex items-center justify-center text-[13px] font-extrabold text-ink tabular-nums">
        {safe}%
      </div>
    </div>
  );
}

function StepRow({ field }: { field: CompletenessFieldMeta }) {
  return (
    <VariantLink
      href={`/me/edit?focus=${field.focus}`}
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors active:bg-black/[0.04]"
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EDE7FF] text-base"
        aria-hidden
      >
        {field.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-bold text-ink">{field.cta}</p>
        {field.reward > 0 && (
          <p className="text-[11px] font-semibold text-primary">
            +{field.reward} credits
          </p>
        )}
      </div>
      <span className="text-[13px] font-bold text-primary">Doen ›</span>
    </VariantLink>
  );
}

export function ProfileStrengthCard({
  state,
  unclaimedReward,
}: {
  state: Pick<
    EditProfileState,
    | "firstName"
    | "age"
    | "location"
    | "bio"
    | "interests"
    | "mainPhotoUrl"
    | "gallery"
  >;
  /** Total credits the user can still earn by completing remaining fields. */
  unclaimedReward?: number;
}) {
  const report = getProfileCompleteness(state);
  const isDone = report.percent >= 100;
  const visibleSteps = report.nextSteps.slice(0, 3);

  if (isDone) {
    return (
      <section className="px-5 pb-4">
        <div className="rounded-2xl bg-gradient-to-r from-emerald-50 via-white to-emerald-50 p-4 shadow-sm ring-1 ring-emerald-200/60">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm"
              aria-hidden
            >
              ✓
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-extrabold text-emerald-700">
                Profiel compleet
              </p>
              <p className="text-[12px] text-emerald-700/80">
                Mensen reageren tot 5× sneller op een volledig profiel
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  const reward =
    typeof unclaimedReward === "number"
      ? unclaimedReward
      : visibleSteps.reduce((s, f) => s + f.reward, 0);

  return (
    <section className="px-5 pb-4">
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/[0.04]">
        <div className="flex items-center gap-3 px-4 pt-4">
          <ProgressRing percent={report.percent} />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-extrabold text-ink">
              Maak je profiel af
            </p>
            <p className="text-[12px] leading-snug text-gray-500">
              {report.completedCount} van {report.totalCount} vakjes ingevuld
              {reward > 0 && (
                <>
                  {" "}
                  · verdien nog{" "}
                  <span className="font-bold text-primary">
                    {reward} credits
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-1 px-2 pb-2">
          {visibleSteps.map((f) => (
            <StepRow key={f.key} field={f} />
          ))}
          {report.nextSteps.length > visibleSteps.length && (
            <VariantLink
              href="/me/edit"
              className="self-end px-3 pt-1 text-[12px] font-semibold text-primary"
            >
              Toon alle ›
            </VariantLink>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Re-export the helper so call-sites that need to know whether a field is
 * filled (e.g. the chat photo gate) don't need to duplicate logic.
 */
export { COMPLETENESS_FIELDS, TOTAL_PROFILE_REWARD_CREDITS };
export type { CompletenessField };
