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
 *   2. **Bedtime context** (see lib/ai/bedtime.ts) — each persona has a
 *      *random-but-deterministic* bedtime per night in [01:45, 03:35]. If
 *      `now` is past her bedtime she's asleep; reply scheduled for the
 *      morning. If `now` is within the last hour before bedtime ("approach"),
 *      we clamp the reply to land before bedtime so a goodnight message can
 *      fit; the prompt builder is told to write a warm goodnight.
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
  /** Persona id (chat_profiles.id). Required to derive a deterministic
   * per-persona bedtime so two pacing calls for the same user message
   * always agree on tonight's sleep schedule. */
  personaId: string;
  /** How many AI replies have already happened in this thread (0 = first). */
  turnIndex: number;
  /** Length in chars of the user message we're replying to. */
  userMessageChars: number;
  /** Length in chars of OUR drafted reply (post-process applied). */
  replyChars: number;
  /** Persona's local "now". Defaults to the server's `new Date()`. */
  nowLocal?: Date;
  /** IANA timezone for the persona's clock (bedtime / wake). Defaults to Europe/Amsterdam. */
  timeZone?: string;
  /** When the persona last replied in this thread, if ever. Drives engagement state
   * and "already-said-goodnight" detection. */
  peerLastReplyAt?: Date | null;
};

import {
  getBedtimeContext,
  type BedtimePhase,
} from "@/lib/ai/bedtime";

export type PacingResult = {
  /** Wall-clock delay before her reply lands. */
  delayMs: number;
  /** Bedtime phase at scheduling time — pass to the prompt builder so the
   * reply tone matches (goodnight when approaching, normal otherwise). */
  bedtimePhase: BedtimePhase;
  /** Minutes until her bedtime when phase === "approaching", else null. */
  minutesUntilBedtime: number | null;
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
 * Compute the AI peer's reply delay AND the bedtime phase to use when
 * building the system prompt. Returns both in one shot so callers don't
 * have to re-derive bedtime themselves (and risk inconsistency).
 *
 * Outputs:
 *   - `delayMs`: wall-clock delay before her reply lands (~600ms → ~9h).
 *   - `bedtimePhase`: pass to `buildGrokSystemPrompt` so the reply tone
 *     matches her current state (goodnight when approaching, morning when
 *     just-woken-up, normal otherwise).
 */
export function computeReplyPacing(opts: PacingInput): PacingResult {
  const turnIndex = Math.max(0, Math.floor(opts.turnIndex));
  const userChars = Math.max(0, opts.userMessageChars);
  const replyChars = Math.max(0, opts.replyChars);
  const now = opts.nowLocal ?? new Date();
  const tz = opts.timeZone ?? defaultTimeZone();

  if (isPacingDisabled()) {
    return { delayMs: 0, bedtimePhase: "awake", minutesUntilBedtime: null };
  }

  const bedtime = getBedtimeContext({
    now,
    timeZone: tz,
    personaId: opts.personaId,
    peerLastReplyAt: opts.peerLastReplyAt ?? null,
  });

  // 1. Hook mode: first 3 turns are always snappy. We never override this,
  // even during bedtime — if she just opened your chat at 02:00, she's still
  // in the "hooked-on-you" phase and answers fast. Sleep mode kicks in for
  // turn 4+.
  if (turnIndex < HOOK_TURN_LIMIT) {
    const base = 600 + Math.min(userChars * 8, 600);
    const jitter = Math.random() * 600 - 300;
    return {
      delayMs: clampMs(base + jitter, 400, 1800),
      bedtimePhase: bedtime.phase,
      minutesUntilBedtime: bedtime.minutesUntilBedtime,
    };
  }

  // 2. Asleep: schedule for tomorrow morning's wake-up.
  if (bedtime.phase === "asleep") {
    const delay = bedtime.wakeAfter.getTime() - now.getTime();
    return {
      delayMs: clampMs(delay, 3 * 60_000, HARD_CAP_MS),
      bedtimePhase: "asleep",
      minutesUntilBedtime: null,
    };
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
  let total = (raw + typingBonus + readingBonus) * (0.9 + Math.random() * 0.2);

  // 8. Approaching-bedtime clamp: if her bedtime is within the next hour,
  // ensure the reply lands at least 60s before bedtime so the goodnight
  // message has time to land before she "drops her phone". Without this
  // clamp a 25-min COLD reply scheduled at 03:20 (bedtime 03:30) would
  // either crowd or skip past bedtime entirely.
  if (bedtime.phase === "approaching") {
    const msUntilBed = bedtime.bedtime.getTime() - now.getTime();
    const maxBeforeBed = Math.max(15_000, msUntilBed - 60_000);
    if (total > maxBeforeBed) total = maxBeforeBed;
  }

  return {
    delayMs: clampMs(total, 5_000, HARD_CAP_MS),
    bedtimePhase: bedtime.phase,
    minutesUntilBedtime: bedtime.minutesUntilBedtime,
  };
}

export function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}
