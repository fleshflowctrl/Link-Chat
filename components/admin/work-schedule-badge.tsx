"use client";

/**
 * Read-only display of the work-schedule the chat pacing layer will use
 * for this persona, derived from her free-form occupation string.
 *
 * The pacing layer (lib/ai/work-schedule.ts) classifies the occupation
 * via keyword match and applies a per-category schedule (workdays,
 * shift hours, breaks). Without this badge, operators have no visibility
 * into when the persona will actually be available to chat — they'd
 * have to read the source to know that "juf" → Mon-Fri 08:15-15:45 with
 * a 10:25 ochtendpauze.
 *
 * The badge updates live as the operator types in the occupation field,
 * so they can verify the classification picked up the right keywords.
 */

import { describeSchedule } from "@/lib/ai/work-schedule";

type Props = {
  occupation: string | null | undefined;
};

export function WorkScheduleBadge({ occupation }: Props) {
  const summary = describeSchedule(occupation);
  const trimmed = (occupation ?? "").trim();
  const noOccupation = trimmed.length === 0;

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
      <div className="flex items-center gap-2 text-gray-700">
        <ClockIcon />
        <span className="font-semibold">Chat-werkschema</span>
        <span className="text-gray-400">· afgeleid van beroep</span>
      </div>

      {noOccupation ? (
        <p className="mt-2 text-gray-500">
          Geen beroep ingevuld — flexibel, altijd beschikbaar.
        </p>
      ) : summary.isFlexible ? (
        <div className="mt-2 space-y-1">
          <p className="text-gray-700">
            Geclassificeerd als{" "}
            <span className="font-medium">{summary.categoryLabel}</span> —
            geen vast schema, bijna altijd beschikbaar.
          </p>
          <p className="text-gray-500">{summary.phoneHint}</p>
        </div>
      ) : (
        <div className="mt-2 space-y-1.5 text-gray-700">
          <p>
            Geclassificeerd als{" "}
            <span className="font-medium">{summary.categoryLabel}</span>
          </p>
          <p>
            <span className="text-gray-500">Werkdagen:</span>{" "}
            <span className="font-medium">{summary.workDaysLabel}</span>
          </p>
          {summary.shifts.map((s, idx) => (
            <p key={idx}>
              <span className="text-gray-500">
                {summary.shifts.length > 1 ? `Shift ${idx + 1}:` : "Tijden:"}
              </span>{" "}
              <span className="font-medium">{s.hoursLabel}</span>
              <span className="text-gray-500"> · {s.breaksLabel}</span>
            </p>
          ))}
          <p className="pt-1 text-xs text-gray-500">{summary.phoneHint}</p>
        </div>
      )}
    </div>
  );
}

function ClockIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
