/**
 * All user-facing chat/inbox timestamps use Europe/Amsterdam — never the
 * server's default TZ (Vercel = UTC) or ambiguous local parsing.
 */

export const APP_TIME_ZONE = "Europe/Amsterdam";

const NL_TIME: Intl.DateTimeFormatOptions = {
  timeZone: APP_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: false,
};

const NL_DATE_SHORT: Intl.DateTimeFormatOptions = {
  timeZone: APP_TIME_ZONE,
  day: "numeric",
  month: "short",
};

export function parseInstant(iso: string | Date): Date {
  return typeof iso === "string" ? new Date(iso) : iso;
}

/** `yyyy-MM-dd` in Amsterdam — for same-day / yesterday checks. */
export function amsterdamDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function amsterdamClockParts(d: Date): {
  hour: number;
  minute: number;
  second: number;
} {
  const map = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: APP_TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return {
    hour: parseInt(map.hour ?? "0", 10),
    minute: parseInt(map.minute ?? "0", 10),
    second: parseInt(map.second ?? "0", 10),
  };
}

/** Bubble time, e.g. "0:25" or "22:19" — always Amsterdam. */
export function formatTimeLabelAmsterdam(iso: string | Date): string {
  const d = parseInstant(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("nl-NL", NL_TIME).format(d);
}

/** Minutes from midnight in Amsterdam (for message grouping). */
export function minuteOfDayAmsterdam(iso: string | Date): number {
  const { hour, minute, second } = amsterdamClockParts(parseInstant(iso));
  return hour * 60 + minute + second / 60;
}

export function nowAmsterdamClock(): {
  timeLabel: string;
  minuteOfDay: number;
} {
  const now = new Date();
  return {
    timeLabel: formatTimeLabelAmsterdam(now),
    minuteOfDay: minuteOfDayAmsterdam(now),
  };
}

function amsterdamYesterdayKey(now: Date): string {
  for (let h = 12; h <= 36; h += 12) {
    const candidate = new Date(now.getTime() - h * 3_600_000);
    const key = amsterdamDateKey(candidate);
    if (key !== amsterdamDateKey(now)) return key;
  }
  return amsterdamDateKey(new Date(now.getTime() - 86_400_000));
}

function amsterdamCalendarDaysBetween(earlier: Date, later: Date): number {
  const a = amsterdamDateKey(earlier);
  const b = amsterdamDateKey(later);
  const da = new Date(`${a}T12:00:00.000Z`);
  const db = new Date(`${b}T12:00:00.000Z`);
  return Math.max(0, Math.round((db.getTime() - da.getTime()) / 86_400_000));
}

/** Inbox row timestamp (Nu / 22:19 / Gisteren / 3 d geleden). */
export function isoToThreadTimeLabelAmsterdam(iso: string | null): string {
  if (!iso) return "—";
  const d = parseInstant(iso);
  if (Number.isNaN(d.getTime())) return "—";

  const now = new Date();
  if (now.getTime() - d.getTime() < 60_000) return "Nu";

  const msgDay = amsterdamDateKey(d);
  const today = amsterdamDateKey(now);
  if (msgDay === today) return formatTimeLabelAmsterdam(d);

  if (msgDay === amsterdamYesterdayKey(now)) return "Gisteren";

  const daysAgo = amsterdamCalendarDaysBetween(d, now);
  if (daysAgo >= 2 && daysAgo < 7) return `${daysAgo} d geleden`;

  return new Intl.DateTimeFormat("nl-NL", NL_DATE_SHORT).format(d);
}

/** "Gelezen 14:32" / gisteren 9:05 / 5 dec */
export function formatReadTimeAmsterdam(iso: string): string {
  const d = parseInstant(iso);
  if (Number.isNaN(d.getTime())) return "";

  const now = new Date();
  const msgDay = amsterdamDateKey(d);
  const today = amsterdamDateKey(now);

  if (msgDay === today) return formatTimeLabelAmsterdam(d);

  if (msgDay === amsterdamYesterdayKey(now)) {
    return `gisteren ${formatTimeLabelAmsterdam(d)}`;
  }

  return new Intl.DateTimeFormat("nl-NL", NL_DATE_SHORT).format(d);
}

/** Re-apply Amsterdam labels (client hydration safety net). */
export function withAmsterdamMessageTimes<T extends {
  createdAt?: string;
  timeLabel: string;
  minuteOfDay: number;
}>(msg: T): T {
  if (!msg.createdAt) return msg;
  return {
    ...msg,
    timeLabel: formatTimeLabelAmsterdam(msg.createdAt),
    minuteOfDay: minuteOfDayAmsterdam(msg.createdAt),
  };
}
