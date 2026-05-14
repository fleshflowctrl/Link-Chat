/**
 * Human-like reply pacing for the AI peer.
 *
 * The route currently calls Grok and returns the reply instantly. That's the
 * single biggest "AI tell" left in the chat — real people read, think, type,
 * occasionally drift. We hold the HTTP response open for a calculated delay
 * (capped under the route's `maxDuration`) so the client shows a typing
 * indicator for the right amount of time before the bubble pops in.
 *
 * Strategy:
 * - First 3 turns: snappy "hook" timing (~0.6–1.8s). She just opened your
 *   chat, she's into it, replies are quick. This is the engagement hook.
 * - Turn 4+: realistic phone-typing timing — read user message (≈30ms/char),
 *   think (1–3.5s), type reply (≈70ms/char), with small jitter and a 10%
 *   chance of a "got distracted" bonus pause (up to 8s) once we're deeper in.
 * - Hard cap: 25s. Anything longer would risk HTTP/serverless timeouts and
 *   would be more naturally handled with async delivery (out of scope here).
 *
 * Override / kill-switch via env: set `XAI_DISABLE_PACING=1` to reply
 * instantly (useful during development / load testing).
 */

export type PacingInput = {
  /** How many AI replies have already happened in this thread (0 = first reply). */
  turnIndex: number;
  /** Length in chars of the user message we're replying to. */
  userMessageChars: number;
  /** Length in chars of OUR drafted reply (post-process applied). */
  replyChars: number;
};

const HARD_CAP_MS = 25_000;
const HOOK_TURN_LIMIT = 3;

function isPacingDisabled(): boolean {
  const raw = process.env.XAI_DISABLE_PACING?.trim().toLowerCase();
  if (!raw) return false;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/** Map (input → ms). Pure / deterministic except for `Math.random()`. */
export function computeReplyDelayMs(opts: PacingInput): number {
  if (isPacingDisabled()) return 0;

  const turnIndex = Math.max(0, Math.floor(opts.turnIndex));
  const userChars = Math.max(0, opts.userMessageChars);
  const replyChars = Math.max(0, opts.replyChars);

  if (turnIndex < HOOK_TURN_LIMIT) {
    // Hook mode: snappy. Scale very loosely with user-message length so a
    // long message still gets *slightly* longer wait than a one-liner, but
    // never more than ~1.8s.
    const base = 600 + Math.min(userChars * 8, 600); // 600–1200 ms
    const jitter = Math.random() * 600 - 300; // ±300ms
    return clampMs(base + jitter, 400, 1800);
  }

  // Realistic mode (turn 4+): reading + thinking + typing.
  const reading = Math.min(userChars * 30, 2500); // ~30ms/char, cap 2.5s
  const thinking = 1000 + Math.random() * 2500; // 1.0–3.5s
  const typing = Math.min(replyChars * 70, 8000); // ~70ms/char, cap 8s

  // Occasional "I got distracted" bonus once we're past turn 5. 10% chance,
  // 0–8s extra. Mirrors how real people sometimes step away mid-reply.
  const distracted =
    turnIndex > 5 && Math.random() < 0.1 ? Math.random() * 8000 : 0;

  // Mild overall jitter ±15% to avoid a too-uniform cadence across replies.
  const total = reading + thinking + typing + distracted;
  const jittered = total * (0.85 + Math.random() * 0.3);

  return clampMs(jittered, 900, HARD_CAP_MS);
}

function clampMs(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

export function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}
