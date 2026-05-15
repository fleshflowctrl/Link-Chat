/**
 * Per-persona-per-day bedtime modelling.
 *
 * The previous implementation hard-coded SLEEP_START_HOUR = 01:00, which
 * made every persona go to bed at the exact same minute every night and
 * felt obviously synthetic. Real people drift. This module derives a
 * **random-but-deterministic** bedtime within `[01:45, 03:35]` from a hash
 * of `(personaId, calendarDateInTz)`, so:
 *
 *   * The same persona always has the same bedtime on the same night
 *     (consistent across multiple `computeReplyPacing` calls in one
 *     request, and across pacing + prompt-build).
 *   * Different personas have different bedtimes on the same night.
 *   * Each persona's bedtime drifts from night to night, the way actual
 *     human sleep schedules do.
 *
 * Used by:
 *   - lib/ai/reply-pacing.ts — to decide sleep-mode vs awake-mode delivery
 *     and whether to clamp a reply to land before bedtime.
 *   - lib/ai/build-grok-system-prompt.ts — to inject a "you're going to bed
 *     soon, end warmly" hint when in the approaching window so Grok writes
 *     a natural goodnight reply ("ik ga zo slapen, spreken we morgen weer").
 */

const BEDTIME_MIN_MINUTE = 1 * 60 + 45; // 01:45
const BEDTIME_MAX_MINUTE = 3 * 60 + 35; // 03:35
const BEDTIME_SPAN = BEDTIME_MAX_MINUTE - BEDTIME_MIN_MINUTE; // 110 minutes

/** Window before bedtime in which she's "winding down" — the system prompt
 * gets a goodnight hint. 60 minutes is a comfortable lead-in: any longer
 * and the prompt nags too early; any shorter and short-message conversations
 * never land in the approach window. */
const APPROACH_WINDOW_MS = 60 * 60_000;

/** Wake-up window after bedtime (in 24h decimal hours, persona-local). */
const WAKE_HOUR_MIN = 7.5;
const WAKE_HOUR_MAX = 9.0;

export type BedtimePhase = "awake" | "approaching" | "asleep";

export type BedtimeContext = {
  /** Persona's bedtime for the current night, as an absolute Date. */
  bedtime: Date;
  /** Wake-up time the morning after that bedtime, as an absolute Date. */
  wakeAfter: Date;
  /** Phase relative to `now`. */
  phase: BedtimePhase;
  /** Minutes until bedtime when `phase === "approaching"`, else null. */
  minutesUntilBedtime: number | null;
};

/** FNV-1a 32-bit hash. Stable across processes and runtimes; we only need
 * a deterministic mapping, not cryptographic strength. */
function fnv1a(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** YYYY-MM-DD as it appears on the persona's calendar in `timeZone`. */
function ymdInTz(d: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/** Decimal hour (e.g. 23.75 for 23:45) for `d` in `timeZone`. */
function hourFloatInTz(d: Date, timeZone: string): number {
  try {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const text = fmt.format(d);
    const [h, m] = text.split(":").map((n) => parseInt(n, 10));
    if (!Number.isFinite(h) || !Number.isFinite(m)) return d.getHours();
    return ((h % 24) + 24) % 24 + m / 60;
  } catch {
    return d.getHours();
  }
}

/** Add N days to a YYYY-MM-DD string. */
function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map((n) => parseInt(n, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Build a Date that, when projected into `timeZone`, shows wall clock
 * `ymd` at decimal hour `hourFloat`. Iterates twice to handle DST. */
function dateAtLocalWallClock(
  ymd: string,
  hourFloat: number,
  timeZone: string,
): Date {
  const h = Math.floor(hourFloat);
  const minutes = Math.floor((hourFloat - h) * 60);
  const wall = `${ymd}T${String(h).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
  // Start with UTC interpretation, then offset to match the tz wall clock.
  let candidate = new Date(`${wall}Z`);
  for (let i = 0; i < 2; i++) {
    const projected = hourFloatInTz(candidate, timeZone);
    const desired = h + minutes / 60;
    const diffMin = Math.round((desired - projected) * 60);
    if (diffMin === 0) break;
    candidate = new Date(candidate.getTime() + diffMin * 60_000);
  }
  return candidate;
}

/** Map (personaId, ymd) → minute-of-day in [BEDTIME_MIN_MINUTE, BEDTIME_MAX_MINUTE]. */
function bedtimeMinuteFor(personaId: string, ymd: string): number {
  const h = fnv1a(`${personaId}|${ymd}`);
  return BEDTIME_MIN_MINUTE + (h % BEDTIME_SPAN);
}

/** Wake-up minute-of-day, deterministic per persona+night so the wake time
 * doesn't drift between recomputations. */
function wakeMinuteFor(personaId: string, ymd: string): number {
  const h = fnv1a(`wake|${personaId}|${ymd}`);
  const minMin = WAKE_HOUR_MIN * 60;
  const maxMin = WAKE_HOUR_MAX * 60;
  return Math.floor(minMin + (h % Math.floor(maxMin - minMin)));
}

/** Build the upcoming-or-current-night bedtime instant. */
function nextBedtime(
  now: Date,
  timeZone: string,
  personaId: string,
): { bedtime: Date; ymd: string } {
  const todayYmd = ymdInTz(now, timeZone);
  const todayMin = bedtimeMinuteFor(personaId, todayYmd);
  const todayBedtime = dateAtLocalWallClock(todayYmd, todayMin / 60, timeZone);
  // Bedtime is in the small hours (01:45 - 03:35). If today's already passed,
  // the relevant bedtime is tomorrow's.
  if (todayBedtime.getTime() > now.getTime()) {
    return { bedtime: todayBedtime, ymd: todayYmd };
  }
  const tomorrowYmd = addDaysYmd(todayYmd, 1);
  const tomorrowMin = bedtimeMinuteFor(personaId, tomorrowYmd);
  return {
    bedtime: dateAtLocalWallClock(tomorrowYmd, tomorrowMin / 60, timeZone),
    ymd: tomorrowYmd,
  };
}

/** Build the wake-up instant for the morning of `bedtimeYmd`. The wake-up
 * is on the SAME calendar date as bedtime in tz (since bedtime is post-
 * midnight). */
function wakeAfter(
  bedtimeYmd: string,
  timeZone: string,
  personaId: string,
): Date {
  const min = wakeMinuteFor(personaId, bedtimeYmd);
  return dateAtLocalWallClock(bedtimeYmd, min / 60, timeZone);
}

/**
 * Compute the persona's bedtime context relative to `now`.
 *
 * Phase logic:
 *   - "asleep":      now ∈ [bedtime, wakeAfter]
 *   - "approaching": now < bedtime AND (bedtime - now) <= APPROACH_WINDOW_MS
 *   - "awake":       otherwise
 *
 * Note: if `peerLastReplyAt` is already past bedtime (she said goodnight
 * earlier), we treat her as "asleep" even slightly before her own bedtime —
 * once goodnight is on the table, no more chatting tonight.
 */
export function getBedtimeContext(opts: {
  now: Date;
  timeZone: string;
  personaId: string;
  peerLastReplyAt?: Date | null;
}): BedtimeContext {
  const { bedtime, ymd } = nextBedtime(opts.now, opts.timeZone, opts.personaId);
  const wake = wakeAfter(ymd, opts.timeZone, opts.personaId);

  const nowMs = opts.now.getTime();
  const bedMs = bedtime.getTime();
  const wakeMs = wake.getTime();

  // If we're between bedtime and wake-up, she's asleep.
  if (nowMs >= bedMs && nowMs < wakeMs) {
    return {
      bedtime,
      wakeAfter: wake,
      phase: "asleep",
      minutesUntilBedtime: null,
    };
  }

  // Already-said-goodnight short-circuit: if her last reply was in the
  // approach window or after bedtime, skip "approaching" — she's done for
  // the night.
  const peerMs = opts.peerLastReplyAt?.getTime();
  if (
    typeof peerMs === "number" &&
    peerMs >= bedMs - APPROACH_WINDOW_MS &&
    nowMs < bedMs
  ) {
    return {
      bedtime,
      wakeAfter: wake,
      phase: "asleep",
      minutesUntilBedtime: null,
    };
  }

  // Approaching: within the last hour before bedtime.
  if (nowMs < bedMs && bedMs - nowMs <= APPROACH_WINDOW_MS) {
    return {
      bedtime,
      wakeAfter: wake,
      phase: "approaching",
      minutesUntilBedtime: Math.max(1, Math.round((bedMs - nowMs) / 60_000)),
    };
  }

  return {
    bedtime,
    wakeAfter: wake,
    phase: "awake",
    minutesUntilBedtime: null,
  };
}
