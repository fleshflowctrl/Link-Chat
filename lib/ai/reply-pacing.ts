/**
 * Human-like reply pacing for the AI peer.
 *
 * The route used to call Grok and reply instantly — the single biggest "AI
 * tell" left. Real people reply with wildly variable timing: sometimes within
 * 30 seconds during an active conversation, sometimes after 20 minutes ("ik
 * was ff weg"), sometimes hours (sleep, work, life). We model that here.
 *
 * Strategy (in priority order):
 *   1. **Hook** — first 3 turns are always snappy (0.6-1.8s). She just opened
 *      your chat, she's excited, replies are quick. This is the engagement
 *      hook and we never override it.
 *   2. **Sleep window** — between 23:30 and 07:30 in the persona's local
 *      timezone she's almost certainly asleep. Schedule the reply for the
 *      next morning between 07:45 and 09:30 (random per row).
 *   3. **Engagement state** — based on how recently SHE last replied:
 *      - HOT  (<5min): she's still in the chat tab. Most replies 20s-3min.
 *      - WARM (5-30min): she's around but multitasking. Mostly 1-15min.
 *      - COLD (30min+ / first reply): she has to "come back". Mostly 5-45min,
 *        with occasional hour-long pauses.
 *   4. **Length-aware adjustment** — long replies (longer to type) get a
 *      small bonus delay; very short replies stay snappy.
 *
 * The output can be anywhere from a few hundred ms to several hours. The
 * caller decides how to deliver:
 *   - delay <= SYNC_DELAY_THRESHOLD_MS: hold HTTP response open and reply
 *     in-line (current synchronous path)
 *   - delay >  SYNC_DELAY_THRESHOLD_MS: insert chat_pending_replies row and
 *     let the client trigger delivery at scheduled_at via /poll-pending
 *
 * Override / kill-switch: set `XAI_DISABLE_PACING=1` to reply instantly.
 */

export type PacingInput = {
  /** How many AI replies have already happened in this thread (0 = first). */
  turnIndex: number;
  /** Length in chars of the user message we're replying to. */
  userMessageChars: number;
  /** Length in chars of OUR drafted reply (post-process applied). */
  replyChars: number;
  /** Persona's local "now". Defaults to the server's `new Date()`. */
  nowLocal?: Date;
  /** IANA timezone for the persona's clock (sleep window). Defaults to Europe/Amsterdam. */
  timeZone?: string;
  /** When the persona last replied in this thread, if ever. Drives engagement state. */
  peerLastReplyAt?: Date | null;
};

/** Replies whose target delay is within this threshold are delivered
 * synchronously (HTTP response held open). Anything longer goes to the
 * async pending-reply queue. 25s is comfortably under the route's 120s
 * `maxDuration` and well under typical serverless timeouts. */
export const SYNC_DELAY_THRESHOLD_MS = 25_000;

/** Upper bound on any single delay. 12h covers full overnight sleep cycles
 * (e.g. message at 23:30 → reply ~08:30 next morning) but prevents pathological
 * values from leaking through. Awake-hour distributions never reach this. */
const HARD_CAP_MS = 12 * 60 * 60_000;
const HOOK_TURN_LIMIT = 3;

/** Sleep window in 24h decimal hours (persona-local). 23:30 - 07:30. */
const SLEEP_START_HOUR = 23.5;
const SLEEP_END_HOUR = 7.5;
/** When she "wakes up", reply lands between these hours (random per row). */
const WAKE_HOUR_MIN = 7.75;
const WAKE_HOUR_MAX = 9.5;

function isPacingDisabled(): boolean {
  const raw = process.env.XAI_DISABLE_PACING?.trim().toLowerCase();
  if (!raw) return false;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function defaultTimeZone(): string {
  const env = process.env.PERSONA_DEFAULT_TZ?.trim();
  if (env) return env;
  return "Europe/Amsterdam";
}

/** Decimal hour (e.g. 23.75 for 23:45) in the given tz. */
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

/** Compute next-wake target time, returning a Date. Uses formatToParts trick
 * to combine "tomorrow's date in tz" with the random wake hour. */
function nextWakeTime(now: Date, timeZone: string): Date {
  const wakeHour = WAKE_HOUR_MIN + Math.random() * (WAKE_HOUR_MAX - WAKE_HOUR_MIN);
  const wakeH = Math.floor(wakeHour);
  const wakeM = Math.floor((wakeHour - wakeH) * 60);

  // Determine "the day she'll wake up" in the persona tz. If now is past
  // midnight (00:00–07:30), wake-up is *today* in tz; if it's late evening
  // (23:30–24:00), wake-up is *tomorrow* in tz.
  const hourNow = hourFloatInTz(now, timeZone);
  const wakingToday = hourNow < SLEEP_END_HOUR;

  // Build the wake instant by formatting today's date in tz, parsing it back,
  // then setting H/M. We use a "noon trick" to find the calendar date in tz
  // robustly across DST transitions.
  let target = new Date(now.getTime());
  if (!wakingToday) {
    target = new Date(target.getTime() + 24 * 3600_000);
  }
  // Get YYYY-MM-DD as seen in the tz
  const dateFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const ymd = dateFmt.format(target); // e.g. "2026-05-15"
  // Construct an ISO-ish string assuming the tz is +02:00 / +01:00; we don't
  // know offset, so use a roundtrip: build a Date in tz by interpreting the
  // wall clock literally via Date constructor + adjust.
  // Cheap robust approach: build "ymdTHH:MM:00" in tz, then iterate Date()
  // candidates to find one whose tz-projected wall clock matches.
  const wallText = `${ymd}T${String(wakeH).padStart(2, "0")}:${String(wakeM).padStart(2, "0")}:00`;
  // Try UTC first, then adjust by tz offset diff.
  const utcGuess = new Date(`${wallText}Z`);
  const projected = hourFloatInTz(utcGuess, timeZone);
  const desired = wakeH + wakeM / 60;
  const diffHours = desired - projected;
  let result = new Date(utcGuess.getTime() + Math.round(diffHours * 3600_000));
  // Ensure we're returning a future time (in case of tz quirks).
  if (result.getTime() <= now.getTime()) {
    result = new Date(result.getTime() + 24 * 3600_000);
  }
  return result;
}

type EngagementMode = "hot" | "warm" | "cold";

function engagementMode(peerInactiveMs: number): EngagementMode {
  if (peerInactiveMs < 5 * 60_000) return "hot";
  if (peerInactiveMs < 30 * 60_000) return "warm";
  return "cold";
}

function pickWeighted(buckets: Array<[number, number]>): number {
  // buckets: [weight, delayInMs]. Returns one delayInMs by weighted random.
  const total = buckets.reduce((s, [w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [w, ms] of buckets) {
    r -= w;
    if (r <= 0) return ms;
  }
  return buckets[buckets.length - 1][1];
}

function rng(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function clampMs(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

/**
 * Pure (modulo Math.random()) function returning the wall-clock delay in ms
 * the AI peer should wait before her reply lands. May be anywhere from
 * ~600ms (hook) to ~6h (sleep / cold morning).
 */
export function computeReplyDelayMs(opts: PacingInput): number {
  if (isPacingDisabled()) return 0;

  const turnIndex = Math.max(0, Math.floor(opts.turnIndex));
  const userChars = Math.max(0, opts.userMessageChars);
  const replyChars = Math.max(0, opts.replyChars);
  const now = opts.nowLocal ?? new Date();
  const tz = opts.timeZone ?? defaultTimeZone();

  // 1. Hook mode: first 3 turns are always snappy. We never override this.
  if (turnIndex < HOOK_TURN_LIMIT) {
    const base = 600 + Math.min(userChars * 8, 600);
    const jitter = Math.random() * 600 - 300;
    return clampMs(base + jitter, 400, 1800);
  }

  // 2. Sleep window: she's asleep, schedule for tomorrow morning.
  const hourNow = hourFloatInTz(now, tz);
  const inSleepWindow = hourNow >= SLEEP_START_HOUR || hourNow < SLEEP_END_HOUR;
  if (inSleepWindow) {
    const wakeAt = nextWakeTime(now, tz);
    const delay = wakeAt.getTime() - now.getTime();
    // Sanity floor: if computation lands within the next minute (DST quirk),
    // bump to at least a few minutes so she "wakes up properly".
    return clampMs(delay, 3 * 60_000, HARD_CAP_MS);
  }

  // 3. Engagement state from peerLastReplyAt.
  const peerInactiveMs =
    opts.peerLastReplyAt instanceof Date
      ? Math.max(0, now.getTime() - opts.peerLastReplyAt.getTime())
      : Number.POSITIVE_INFINITY;
  const mode = engagementMode(peerInactiveMs);

  // 4. Mode-based weighted distribution. Numbers are minutes for readability.
  let raw: number;
  if (mode === "hot") {
    raw = pickWeighted([
      [70, rng(20_000, 90_000)],         // 70%: 20-90s
      [22, rng(90_000, 240_000)],        // 22%: 1.5-4 min
      [8,  rng(240_000, 600_000)],       // 8%:  4-10 min
    ]);
  } else if (mode === "warm") {
    raw = pickWeighted([
      [40, rng(60_000, 180_000)],        // 40%: 1-3 min
      [35, rng(180_000, 600_000)],       // 35%: 3-10 min
      [20, rng(600_000, 1_800_000)],     // 20%: 10-30 min
      [5,  rng(1_800_000, 3_600_000)],   // 5%:  30-60 min
    ]);
  } else {
    raw = pickWeighted([
      [30, rng(120_000, 300_000)],       // 30%: 2-5 min
      [30, rng(300_000, 1_200_000)],     // 30%: 5-20 min
      [30, rng(1_200_000, 3_600_000)],   // 30%: 20-60 min
      [10, rng(3_600_000, 4 * 3_600_000)], // 10%: 1-4h
    ]);
  }

  // 5. Length-aware bonus: a longer reply takes longer to compose. We add up
  // to ~8s of typing time on top, which only matters in hot mode (otherwise
  // it's lost in the noise of the multi-minute pause).
  const typingBonus = Math.min(replyChars * 70, 8000);

  // 6. Reading bonus: long user messages need to be read. Capped 2.5s.
  const readingBonus = Math.min(userChars * 30, 2500);

  // 7. Mild jitter ±10% so two consecutive replies never share a delay.
  const total = (raw + typingBonus + readingBonus) * (0.9 + Math.random() * 0.2);

  return clampMs(total, 5_000, HARD_CAP_MS);
}

export function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}
