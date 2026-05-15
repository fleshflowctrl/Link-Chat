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
  /** Free-form occupation string from chat_profiles. Drives the work-
   * schedule classifier so during work hours replies cluster around
   * breaks and end-of-shift instead of dropping at random times.
   * Pass null/empty to skip work-schedule logic (legacy callers). */
  occupation?: string | null;
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

/** Upper bound on any single delay. 9h covers a full overnight sleep cycle
 * (e.g. message at 00:30 → reply ~08:30 next morning) but caps any
 * pathological non-sleep value at "obviously too long for a dating chat". */
const HARD_CAP_MS = 9 * 60 * 60_000;
const HOOK_TURN_LIMIT = 3;

/** Probability she sneaks a phone-glance during work and replies with a
 * 10-30 min delay (instead of waiting for the next break). Operator
 * request: "soms tijdens werk wel appen, gewoon 10-30 min eroverheen".
 * 15% per turn means roughly 1 in 7 work-time messages still gets a
 * reply during the shift — feels realistic without breaking the
 * "phone-away during work" mental model.
 *
 * Override via env XAI_WORK_SNEAKY_PROBABILITY="0.15" if needed. */
const WORK_SNEAKY_PROBABILITY = (() => {
  const raw = process.env.XAI_WORK_SNEAKY_PROBABILITY;
  if (typeof raw === "string") {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0 && n <= 1) return n;
  }
  return 0.15;
})();

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

  // 1. Hook mode: first 3 turns are always snappy. We never override this,
  // even during bedtime or work — if she just opened your chat at 02:00 or
  // during her lunch shift, she's still in the "hooked-on-you" phase and
  // answers fast. Sleep / work mode kicks in for turn 4+.
  if (turnIndex < HOOK_TURN_LIMIT) {
    const base = 600 + Math.min(userChars * 8, 600);
    const jitter = Math.random() * 600 - 300;
    return {
      delayMs: clampMs(base + jitter, 400, 1800),
      bedtimePhase: bedtime.phase,
      minutesUntilBedtime: bedtime.minutesUntilBedtime,
      workPhase: work.phase,
      workPromptHint: work.promptHint,
    };
  }

  // 2. Asleep: schedule for tomorrow morning's wake-up.
  if (bedtime.phase === "asleep") {
    const delay = bedtime.wakeAfter.getTime() - now.getTime();
    return {
      delayMs: clampMs(delay, 3 * 60_000, HARD_CAP_MS),
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
    const sneaky = Math.random() < WORK_SNEAKY_PROBABILITY;
    if (sneaky) {
      const sneakyDelayMs = (10 + Math.random() * 20) * 60_000; // 10-30 min
      // Make sure the sneaky reply lands well before the end of shift
      // — past that we should just wait for end-of-day naturally.
      const msToShiftEnd = work.nextAvailableAt.getTime() - now.getTime();
      const cappedSneaky = Math.min(sneakyDelayMs, Math.max(60_000, msToShiftEnd - 60_000));
      return {
        delayMs: clampMs(cappedSneaky, 60_000, HARD_CAP_MS),
        bedtimePhase: bedtime.phase,
        minutesUntilBedtime: bedtime.minutesUntilBedtime,
        workPhase: "working",
        // Override the prompt hint with a sneaky-glance phrasing so
        // Grok writes "ik kijk eigenlijk niet op werk maar oké, ff snel"
        // instead of the normal "ik moet zo aan het werk".
        workPromptHint: SNEAKY_GLANCE_HINT(work.localTimeLabel),
      };
    }
    const delay = work.nextAvailableAt.getTime() - now.getTime();
    if (delay > 60_000) {
      return {
        // 30s jitter so two pending replies don't all fire at the
        // exact same break-minute.
        delayMs: clampMs(delay + Math.random() * 30_000, 60_000, HARD_CAP_MS),
        bedtimePhase: bedtime.phase,
        minutesUntilBedtime: bedtime.minutesUntilBedtime,
        workPhase: work.phase,
        workPromptHint: work.promptHint,
      };
    }
    // Less than a minute until the next break — fall through to normal
    // pacing so the reply lands naturally as the break starts.
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
    delayMs: clampMs(total, 5_000, HARD_CAP_MS),
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
