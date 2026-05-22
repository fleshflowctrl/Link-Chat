/**
 * Greeting deduper — one greeting max, no weird openings on combined user intent.
 * Runs after session-fact-consistency-guard, before split / language cleanup.
 */

import type { NormalizedUserIntent } from "@/lib/ai/message-intent-normalizer";
import type { RecentTurn } from "@/lib/ai/conversation-state-guard";
import { MULTI_MESSAGE_SEPARATOR } from "@/lib/ai/post-process-reply";

const LEADING_EMOJI_RE = /^[\s\u2600-\u27BF\uD800-\uDBFF][\uDC00-\uDFFF]*/;

const GREETING_CHUNK_RE =
  /^(?:hoi|hey|heyy|hallo|goedemorgen|goedenavond)\b/i;

function stripLeadingEmoji(s: string): string {
  return s.replace(LEADING_EMOJI_RE, "").trimStart();
}

const WEIRD_OPENING_RES: RegExp[] = [
  /\bhoe gaat je op deze (?:maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag|week)\b/gi,
  /\bhoe gaat je op deze\b/gi,
  /\bhoe is jouw dag tot nu toe\b/gi,
  /\bhoe ziet jouw (?:dag|vrijdag|week) eruit\b/gi,
  /\bwat ga je (?:vandaag )?doen\b/gi,
  /\bhoegaat\b/gi,
];

const GENERIC_DAY_QUESTION_RES: RegExp[] = [
  /\bhoe is (?:jouw|je) dag\b/gi,
  /\bhoe ziet (?:jouw|je) dag eruit\b/gi,
  /\bhoe gaat (?:jouw|je) dag\b/gi,
];

export type GreetingDedupeResult = {
  text: string;
  guardApplied: boolean;
  greetingRemoved: boolean;
  duplicateGreetingDetected: boolean;
  weirdDutchDetected: boolean;
  invalidReasons: string[];
};

function splitBubbles(text: string): string[] {
  if (!text.includes(MULTI_MESSAGE_SEPARATOR)) return [text.trim()].filter(Boolean);
  return text
    .split(/\n*\s*<<<>>>\s*\n*/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function joinBubbles(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return parts.join(`\n${MULTI_MESSAGE_SEPARATOR}\n`);
}

function chunkIsGreeting(chunk: string): boolean {
  const t = stripLeadingEmoji(chunk.trim());
  if (!GREETING_CHUNK_RE.test(t)) return false;
  const withoutGreet = t.replace(GREETING_CHUNK_RE, "").trim();
  return withoutGreet.length < 35;
}

function stripGreetingFromChunk(chunk: string): string {
  return chunk
    .replace(GREETING_CHUNK_RE, "")
    .replace(/^[,!.\s😊🙂]+/, "")
    .trim();
}

function stripWeirdOpenings(text: string): { text: string; found: boolean } {
  let s = text;
  let found = false;
  for (const re of WEIRD_OPENING_RES) {
    if (re.test(s)) found = true;
    s = s.replace(re, " ");
    re.lastIndex = 0;
  }
  return { text: s.replace(/\s{2,}/g, " ").trim(), found };
}

function detectIssues(
  text: string,
  intent: NormalizedUserIntent,
): { invalidReasons: string[]; duplicateGreeting: boolean; weird: boolean } {
  const invalidReasons: string[] = [];
  const parts = splitBubbles(text);
  const greetCount = parts.filter((p) => chunkIsGreeting(p)).length;
  const duplicateGreeting = greetCount > 1;
  if (duplicateGreeting) invalidReasons.push("duplicate_greeting_in_response");

  if (!intent.shouldBotGreet && greetCount >= 1) {
    invalidReasons.push("greeting_when_should_not");
  }

  let weird = false;
  for (const re of WEIRD_OPENING_RES) {
    if (re.test(text)) {
      weird = true;
      invalidReasons.push("weird_opening_phrase");
      break;
    }
  }

  if (
    intent.combinedUserIntent === "greeting_plus_how_are_you" ||
    intent.combinedUserIntent === "how_are_you"
  ) {
    for (const re of GENERIC_DAY_QUESTION_RES) {
      if (re.test(text)) {
        invalidReasons.push("generic_day_question_after_hoe_gaat_het");
        break;
      }
    }
    if (greetCount >= 1 && /\bgaat\s+prima\b/i.test(text) && parts.length > 1) {
      const firstGreet = parts[0] && chunkIsGreeting(parts[0]);
      const laterGreet = parts.some((p, i) => i > 0 && /\bhoi\b/i.test(p));
      if (firstGreet && laterGreet) invalidReasons.push("double_hoi_prima_pattern");
    }
  }

  return { invalidReasons, duplicateGreeting, weird };
}

function templateForIntent(intent: NormalizedUserIntent): string {
  const sep = `\n${MULTI_MESSAGE_SEPARATOR}\n`;

  switch (intent.combinedUserIntent) {
    case "greeting_plus_how_are_you":
      if (intent.shouldBotGreet) {
        return ["heyy", "gaat prima eigenlijk, beetje rustig vandaag", "met jou?"].join(sep);
      }
      return ["gaat goed hoor", "jij?"].join(sep);
    case "greeting_only":
      return intent.shouldBotGreet ? "heyy" : "hey jij";
    case "how_are_you":
      return intent.shouldBotAskBack
        ? ["gaat wel eigenlijk", "jij?"].join(sep)
        : "gaat wel eigenlijk";
    case "flirt":
      return ["hoi jij", "gaat beter nu natuurlijk", "nee grapje 😭 jij?"].join(sep);
    case "compliment":
      return ["haha smooth hoor", "maar oke fair"].join(sep);
    default:
      return "gaat wel";
  }
}

function dedupeChunks(
  parts: string[],
  intent: NormalizedUserIntent,
): { parts: string[]; greetingRemoved: boolean } {
  let greetingRemoved = false;
  let out = parts.map((p) => p.trim()).filter(Boolean);

  if (!intent.shouldBotGreet) {
    const before = out.length;
    out = out.map((p) => stripGreetingFromChunk(p)).filter((p) => p.length > 0);
    if (out.length !== before || parts.some((p) => chunkIsGreeting(p))) {
      greetingRemoved = true;
    }
  }

  let greetKept = false;
  out = out.filter((p) => {
    if (!chunkIsGreeting(p)) return true;
    if (!intent.shouldBotGreet) {
      greetingRemoved = true;
      return false;
    }
    if (!greetKept) {
      greetKept = true;
      return true;
    }
    greetingRemoved = true;
    return false;
  });

  const cleaned: string[] = [];
  for (const p of out) {
    const { text: stripped, found } = stripWeirdOpenings(p);
    if (
      (intent.combinedUserIntent === "greeting_plus_how_are_you" ||
        intent.combinedUserIntent === "how_are_you") &&
      found
    ) {
      greetingRemoved = true;
      continue;
    }
    if (
      intent.combinedUserIntent === "greeting_plus_how_are_you" &&
      GENERIC_DAY_QUESTION_RES.some((re) => re.test(p))
    ) {
      greetingRemoved = true;
      continue;
    }
    if (stripped.length > 0) cleaned.push(stripped);
  }

  return { parts: cleaned, greetingRemoved };
}

export function applyGreetingDeduper(input: {
  response: string;
  intent: NormalizedUserIntent;
  recentMessages?: RecentTurn[];
}): GreetingDedupeResult {
  const original = input.response.trim();
  const issues = detectIssues(original, input.intent);

  if (issues.invalidReasons.length === 0) {
    return {
      text: original,
      guardApplied: false,
      greetingRemoved: false,
      duplicateGreetingDetected: false,
      weirdDutchDetected: false,
      invalidReasons: [],
    };
  }

  let parts = splitBubbles(original);
  const deduped = dedupeChunks(parts, input.intent);
  parts = deduped.parts;
  let greetingRemoved = deduped.greetingRemoved;

  let joined = joinBubbles(parts);
  const recheck = detectIssues(joined, input.intent);

  if (recheck.invalidReasons.length > 0 || joined.length < 4) {
    joined = templateForIntent(input.intent);
    greetingRemoved = true;
  }

  return {
    text: joined.trim(),
    guardApplied: joined.trim() !== original,
    greetingRemoved,
    duplicateGreetingDetected: issues.duplicateGreeting,
    weirdDutchDetected: issues.weird,
    invalidReasons: issues.invalidReasons,
  };
}

export function logGreetingDeduperDev(meta: {
  normalizedIntent: NormalizedUserIntent;
  shouldBotGreet: boolean;
  greetingRemoved: boolean;
  duplicateGreetingDetected: boolean;
  weirdDutchDetected: boolean;
  originalResponse: string;
  finalResponse: string;
  invalidReasons?: string[];
}): void {
  if (process.env.NODE_ENV !== "development") return;
  console.info(
    "[greeting-deduper]",
    JSON.stringify(
      {
        normalized_intent: meta.normalizedIntent.combinedUserIntent,
        should_bot_greet: meta.shouldBotGreet,
        greeting_removed: meta.greetingRemoved,
        duplicate_greeting_detected: meta.duplicateGreetingDetected,
        weird_dutch_detected: meta.weirdDutchDetected,
        invalid_reasons: meta.invalidReasons,
        original: meta.originalResponse.slice(0, 500),
        final: meta.finalResponse.slice(0, 500),
      },
      null,
      2,
    ),
  );
}
