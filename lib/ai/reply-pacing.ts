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
 *   1. **First reply** — turn 0 is always 1-3 minutes (async). Nobody answers
 *      a brand-new match in under two seconds.
 *   2. **Early hook** — turns 1-2 are 30-90s once she's in the thread.
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
 *        12min, tail up to 20min max while awake.
 *   5. **Awake cap** — any non-sleep delay is clamped to 20 minutes. Only
 *      `bedtimePhase === "asleep"` may schedule until morning wake-up.
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

import type { AppVariant } from "@/lib/app-variant";
import {
  V2_MAX_REPLY_DELAY_MS,
  V2_MIN_REPLY_DELAY_MS,
} from "@/lib/ai/v2-chat-config";

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
  /** Free-form occupation string from chat_profiles. Drives the work-
   * schedule classifier so during work hours replies cluster around
   * breaks and end-of-shift instead of dropping at random times.
   * Pass null/empty to skip work-schedule logic (legacy callers). */
  occupation?: string | null;
  /** v2 pool: replies always within ~1 minute. */
  appVariant?: AppVariant;
};

import {
  getBedtimeContext,
  type BedtimePhase,
} from "@/lib/ai/bedtime";
import {
  getWorkContext,
  type WorkPhase,
} from "@/lib/ai/work-schedule";

export type PacingResult = {
  /** Wall-clock delay before her reply lands. */
  delayMs: number;
  /** Bedtime phase at scheduling time — pass to the prompt builder so the
   * reply tone matches (goodnight when approaching, normal otherwise). */
  bedtimePhase: BedtimePhase;
  /** Minutes until her bedtime when phase === "approaching", else null. */
  minutesUntilBedtime: number | null;
  /** Work phase at scheduling time — pass to the prompt builder so her
   * reply naturally references her current work context (about to start
   * a shift, on break, ending the day). */
  workPhase: WorkPhase;
  /** Free-form Dutch hint for the prompt builder. Empty when off. */
  workPromptHint: string;
};

/** Replies whose target delay is within this threshold are delivered
 * synchronously (HTTP response held open). Anything longer goes to the
 * async pending-reply queue. 25s is comfortably under the route's 120s
 * `maxDuration` and well under typical serverless timeouts. */
export const SYNC_DELAY_THRESHOLD_MS = 25_000;

/** Sync vs async cutoff — v2 allows holding the request open up to 1 minute. */
export function syncDelayThresholdMs(appVariant?: AppVariant): number {
  return appVariant === "v2" ? V2_MAX_REPLY_DELAY_MS : SYNC_DELAY_THRESHOLD_MS;
}

/** Hard ceiling for ANY reply (operator policy: alle replies binnen 2 min,
 * onafhankelijk van bedtime / work / engagement-mode). Used by `capDelayMs`. */
export const MAX_REPLY_DELAY_MS = 120_000;

/** Max delay while awake (not in sleep mode). Operator policy. */
export const AWAKE_MAX_DELAY_MS = MAX_REPLY_DELAY_MS;

/** Upper bound on sleep-mode delays. Same cap so chats keep flowing 24/7. */
const SLEEP_HARD_CAP_MS = MAX_REPLY_DELAY_MS;
const HOOK_TURN_LIMIT = 3;
/** First-ever peer reply in a thread — quick async ack within the 2-min cap. */
const FIRST_REPLY_MIN_MS = 20_000;
const FIRST_REPLY_MAX_MS = 90_000;

/** Build the prompt hint shown to Grok when the persona is sneaking a
 * glance during work. Tone: secret, hurried, slightly guilty. */
function SNEAKY_GLANCE_HINT(localTimeLabel: string): string {
  return (
    `- Werk-context: het is ${localTimeLabel} en je werkt eigenlijk nu. ` +
    `Je kijkt stiekem op je telefoon (mag eigenlijk niet) — schrijf kort en gehaast, ` +
    `met een gevoel van "ff snel even tussendoor" of "even snel een berichtje voor m'n collega het ziet". ` +
    `Niet uitgebreid en ook niet alsof je er rustig de tijd voor hebt. Een paar woorden tot één zin, max twee.`
  );
}

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

/** Operator cap: every reply lands within MAX_REPLY_DELAY_MS, regardless of
 * bedtime / work phase. Sleeping personas still reply within 2 minutes —
 * realism is sacrificed on purpose so live chats never stall. */
function capDelayMs(ms: number, _bedtimePhase: BedtimePhase): number {
  return clampMs(ms, 5_000, MAX_REPLY_DELAY_MS);
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
function computeV2ReplyPacing(opts: PacingInput): PacingResult {
  const turnIndex = Math.max(0, Math.floor(opts.turnIndex));
  const userChars = Math.max(0, opts.userMessageChars);
  const replyChars = Math.max(0, opts.replyChars);
  const now = opts.nowLocal ?? new Date();
  const tz = opts.timeZone ?? defaultTimeZone();

  const bedtime = getBedtimeContext({
    now,
    timeZone: tz,
    personaId: opts.personaId,
    peerLastReplyAt: opts.peerLastReplyAt ?? null,
  });
  const work = getWorkContext({
    now,
    timeZone: tz,
    personaId: opts.personaId,
    occupation: opts.occupation ?? null,
  });

  const peerInactiveMs =
    opts.peerLastReplyAt instanceof Date
      ? Math.max(0, now.getTime() - opts.peerLastReplyAt.getTime())
      : Number.POSITIVE_INFINITY;
  const mode = engagementMode(peerInactiveMs);

  let base: number;
  if (turnIndex === 0) {
    base = rng(12_000, 42_000);
  } else if (turnIndex < 3) {
    base = rng(10_000, 35_000);
  } else if (mode === "hot") {
    base = rng(8_000, 28_000);
  } else if (mode === "warm") {
    base = rng(12_000, 40_000);
  } else {
    base = rng(18_000, 55_000);
  }

  const typingBonus = Math.min(replyChars * 40, 4000);
  const readingBonus = Math.min(userChars * 20, 1500);
  let total = (base + typingBonus + readingBonus) * (0.92 + Math.random() * 0.16);

  return {
    delayMs: clampMs(total, V2_MIN_REPLY_DELAY_MS, V2_MAX_REPLY_DELAY_MS),
    bedtimePhase: bedtime.phase,
    minutesUntilBedtime: bedtime.minutesUntilBedtime,
    workPhase: work.phase,
    workPromptHint: work.promptHint,
  };
}

export function computeReplyPacing(opts: PacingInput): PacingResult {
  const turnIndex = Math.max(0, Math.floor(opts.turnIndex));
  const userChars = Math.max(0, opts.userMessageChars);
  const replyChars = Math.max(0, opts.replyChars);
  const now = opts.nowLocal ?? new Date();
  const tz = opts.timeZone ?? defaultTimeZone();

  if (opts.appVariant === "v2") {
    if (isPacingDisabled()) {
      return {
        delayMs: 0,
        bedtimePhase: "awake",
        minutesUntilBedtime: null,
        workPhase: "off",
        workPromptHint: "",
      };
    }
    return computeV2ReplyPacing(opts);
  }

  if (isPacingDisabled()) {
    return {
      delayMs: 0,
      bedtimePhase: "awake",
      minutesUntilBedtime: null,
      workPhase: "off",
      workPromptHint: "",
    };
  }

  const bedtime = getBedtimeContext({
    now,
    timeZone: tz,
    personaId: opts.personaId,
    peerLastReplyAt: opts.peerLastReplyAt ?? null,
  });

  // Work-context. Even when the persona is "off" (no occupation, weekend,
  // outside shift) we still resolve this so the result fields are
  // populated for the prompt builder.
  const work = getWorkContext({
    now,
    timeZone: tz,
    personaId: opts.personaId,
    occupation: opts.occupation ?? null,
  });

  // 2. Asleep: operator policy overrides realism — reply within the cap
  //    (30-120s) so the chat keeps moving 24/7. Bedtime phase stays
  //    "asleep" so the system prompt can still acknowledge it.
  if (bedtime.phase === "asleep") {
    return {
      delayMs: capDelayMs(rng(30_000, MAX_REPLY_DELAY_MS), "asleep"),
      bedtimePhase: "asleep",
      minutesUntilBedtime: null,
      workPhase: work.phase,
      workPromptHint: work.promptHint,
    };
  }

  // 2b. Working: she's mid-shift and her phone is away. Schedule the
  //     reply for the next break / end-of-shift instead of dropping it
  //     into the middle of her workday. Pacing layer alone handles
  //     this; prompt-builder gets the work hint so the eventual reply
  //     references it ("zat in een vergadering" / "tussen lessen door").
  //
  // Sneaky-glance exception (operator request: "soms tijdens werk wel
  // appen, gewoon 10-30 min eroverheen"): with WORK_SNEAKY_PROBABILITY
  // chance she does sneak a quick look at her phone. We schedule the
  // reply 10-30 min out (not the next break), and flag the prompt so
  // the message acknowledges it ("ff snel even tussendoor"). This
  // makes the work-schedule lever feel realistic instead of robotic
  // (she's not literally untouchable for 4h every day).
  if (work.phase === "working") {
    // Operator policy: alle replies binnen 2 min, ook tijdens werk.
    // We tonen wel het "sneaky-glance" framing zodat het past in het
    // verhaal ("ff snel even tussendoor"), maar wachten niet tot de
    // volgende break.
    return {
      delayMs: capDelayMs(rng(30_000, MAX_REPLY_DELAY_MS), bedtime.phase),
      bedtimePhase: bedtime.phase,
      minutesUntilBedtime: bedtime.minutesUntilBedtime,
      workPhase: "working",
      workPromptHint: SNEAKY_GLANCE_HINT(work.localTimeLabel),
    };
  }

  // 1a. Very first peer reply — 1-3 minutes (async). Not instant.
  if (turnIndex === 0) {
    const delayMs = rng(FIRST_REPLY_MIN_MS, FIRST_REPLY_MAX_MS);
    return {
      delayMs: capDelayMs(delayMs, bedtime.phase),
      bedtimePhase: bedtime.phase,
      minutesUntilBedtime: bedtime.minutesUntilBedtime,
      workPhase: work.phase,
      workPromptHint: work.promptHint,
    };
  }

  // 1b. Turns 1-2: 30-90 seconds (async).
  if (turnIndex < HOOK_TURN_LIMIT) {
    const delayMs = rng(30_000, 90_000);
    return {
      delayMs: capDelayMs(delayMs, bedtime.phase),
      bedtimePhase: bedtime.phase,
      minutesUntilBedtime: bedtime.minutesUntilBedtime,
      workPhase: work.phase,
      workPromptHint: work.promptHint,
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
      [15, rng(720_000, 1_200_000)],     // 15%: 12-20 min — busy moment (awake cap)
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

  // 7b. Nightcap: between 22:00 and bedtime she's more likely on the couch
  // with her phone, half-watching something. Replies stretch a bit and the
  // distribution skews longer. We multiply by 1.3-1.7x — small enough to
  // stay within the bucket buckets, big enough to be felt.
  const msUntilBedtime = bedtime.bedtime.getTime() - now.getTime();
  const nightcapWindow = 4 * 60 * 60_000; // 4h before bedtime ≈ from ~22:30
  if (
    bedtime.phase === "awake" &&
    msUntilBedtime > 0 &&
    msUntilBedtime < nightcapWindow
  ) {
    // Closer to bedtime → larger multiplier, peaks around 1.6x in the last
    // hour before approach window kicks in.
    const proximity = 1 - msUntilBedtime / nightcapWindow; // 0 at 4h before, 1 at bedtime
    const factor = 1.25 + proximity * 0.35; // 1.25 - 1.6
    total *= factor;
  }

  // 7c. Break / lunch dial-down: she's chatting on a short break. Replies
  //     stay snappy but the heavy-tail buckets (>5 min) would push past
  //     the break; clamp so the reply lands well before break ends.
  if (work.phase === "break" || work.phase === "lunch_break") {
    const msUntilBackToWork = work.phaseEndsAt.getTime() - now.getTime();
    const maxBeforeBack = Math.max(15_000, msUntilBackToWork - 30_000);
    if (total > maxBeforeBack) total = maxBeforeBack;
  }

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

  // 8b. Approaching-work clamp: same idea — if her shift starts within the
  //     approach window, ensure the reply lands at least 60s before
  //     start so a "ik moet zo werken" goodbye fits naturally.
  if (work.phase === "approaching_work") {
    const msUntilWork = work.phaseEndsAt.getTime() - now.getTime();
    const maxBeforeWork = Math.max(15_000, msUntilWork - 60_000);
    if (total > maxBeforeWork) total = maxBeforeWork;
  }

  return {
    delayMs: capDelayMs(total, bedtime.phase),
    bedtimePhase: bedtime.phase,
    minutesUntilBedtime: bedtime.minutesUntilBedtime,
    workPhase: work.phase,
    workPromptHint: work.promptHint,
  };
}

export function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}
