/**
 * Human-like reply pacing for the AI peer.
 *
 * The route used to call Grok and reply instantly — the single biggest "AI
 * tell" left. Real people reply with wildly variable timing: sometimes within
 * 30 seconds during an active conversation, sometimes after 20 minutes ("ik
 * was ff weg"), sometimes hours (sleep, work, life). We model that here.
 *
 * Volume-first design: monetisation scales with messages-per-day, so we
 * lean toward short intervals across the board. A real, *interested* match
 * texts a lot. Long pauses exist (sleep, occasional life-happens moment) but
 * are rare and the distributions are heavily front-loaded toward seconds-
 * and-low-minutes territory.
 *
 * Strategy (in priority order):
 *   1. **Hook** — first 3 turns are always snappy (0.6-1.8s). She just opened
 *      your chat, she's excited, replies are quick. This is the engagement
 *      hook and we never override it.
 *   2. **Sleep window** — between 01:00 and 07:30 in the persona's local
 *      timezone she's almost certainly asleep. Schedule the reply for the
 *      next morning between 07:30 and 09:00. Window is intentionally tight:
 *      Dutch dating-app match behaviour is "stays up texting till 1am".
 *   3. **Engagement state** — based on how recently SHE last replied:
 *      - HOT  (<5min): she's still in the chat tab. ~80% under 60s.
 *      - WARM (5-30min): she's around but multitasking. ~65% under 2min.
 *      - COLD (30min+ / first reply): she has to "come back". ~85% under
 *        12min, with a small tail up to ~90min for true "I was busy"
 *        moments. No more multi-hour cold pauses.
 *   4. **Length-aware adjustment** — long replies (longer to type) get a
 *      small bonus delay; very short replies stay snappy.
 *
 * The output can be anywhere from a few hundred ms to a few hours. The
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

/** Upper bound on any single delay. 9h covers a full overnight sleep cycle
 * (e.g. message at 00:30 → reply ~08:30 next morning) but caps any
 * pathological non-sleep value at "obviously too long for a dating chat". */
const HARD_CAP_MS = 9 * 60 * 60_000;
const HOOK_TURN_LIMIT = 3;

/** Sleep window in 24h decimal hours (persona-local). 01:00 - 07:30 — tight
 * by design so personas chat through the late evening into early morning
 * (peak monetisation hours). */
const SLEEP_START_HOUR = 1.0;
const SLEEP_END_HOUR = 7.5;
/** When she "wakes up", reply lands between these hours (random per row).
 * Leans early so users who messaged her overnight get a fast morning reply. */
const WAKE_HOUR_MIN = 7.5;
const WAKE_HOUR_MAX = 9.0;

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
  // The window may or may not cross midnight depending on configuration:
  //   23:30-07:30 (cross-midnight): use OR
  //   01:00-07:30 (same-day):       use AND
  const hourNow = hourFloatInTz(now, tz);
  const inSleepWindow =
    SLEEP_START_HOUR > SLEEP_END_HOUR
      ? hourNow >= SLEEP_START_HOUR || hourNow < SLEEP_END_HOUR
      : hourNow >= SLEEP_START_HOUR && hourNow < SLEEP_END_HOUR;
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

  // 4. Mode-based weighted distribution. Volume-first: most replies land in
  // tens-of-seconds to a few minutes. Longer pauses exist for realism but
  // are rare. Numbers chosen so an average day yields many short exchanges.
  let raw: number;
  if (mode === "hot") {
    raw = pickWeighted([
      [80, rng(15_000, 60_000)],         // 80%: 15-60s — active back-and-forth
      [17, rng(60_000, 180_000)],        // 17%: 1-3 min — brief distraction
      [3,  rng(180_000, 420_000)],       // 3%:  3-7 min — phone-down moment
    ]);
  } else if (mode === "warm") {
    raw = pickWeighted([
      [65, rng(30_000, 120_000)],        // 65%: 30s-2min — back to the chat
      [28, rng(120_000, 480_000)],       // 28%: 2-8 min — multitasking
      [7,  rng(480_000, 1_200_000)],     // 7%:  8-20 min — got pulled away
    ]);
  } else {
    raw = pickWeighted([
      [55, rng(60_000, 240_000)],        // 55%: 1-4 min — comes back fast
      [30, rng(240_000, 720_000)],       // 30%: 4-12 min — was elsewhere
      [13, rng(720_000, 1_800_000)],     // 13%: 12-30 min — busy moment
      [2,  rng(1_800_000, 5_400_000)],   // 2%:  30-90 min — true "I was busy"
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
