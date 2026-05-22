/**
 * Ellipsis realism guard — "..." is occasional seasoning, not default style.
 * Runs after emoji/language cleanup, before quality gate.
 */

import type { ChatTurnPlan } from "@/lib/ai/chat-turn-plan";
import type { CombinedUserIntent } from "@/lib/ai/message-intent-normalizer";
import {
  pickNonRepeatingPersonaGreeting,
  repairBareGreetingChunk,
  type PickPersonaGreetingInput,
} from "@/lib/ai/persona-greeting-style";
import type { ChatStyle } from "@/lib/chat/map-rows";

const ELLIPSIS_RE = /\.{2,}|…+/g;
const SPACED_DOTS_RE = /\s*\.\s*\.\s*\.+/g;

/** Chunks that should never carry ellipsis. */
const SIMPLE_NO_ELLIPSIS_RES: RegExp[] = [
  /^\s*(?:hoi|hey|heyy|hallo)(?:\s+jij)?\s*$/i,
  /^\s*gaat\s+(?:goed|prima|wel)\b/i,
  /^\s*(?:met\s+jou|en\s+jij|jij)\s*\??\s*$/i,
  /^\s*wat\s+doe\s+je\s*\??\s*$/i,
  /^\s*niet\s+veel\b/i,
  /^\s*haha\s+oke\b/i,
];

const DISALLOW_ELLIPSIS_INTENTS: CombinedUserIntent[] = [
  "greeting_only",
  "how_are_you",
  "greeting_plus_how_are_you",
];

export type EllipsisRealismGuardInput = {
  chunks: string[];
  recentBotMessages: string[];
  currentUserMessage: string;
  combinedUserIntent?: CombinedUserIntent;
  chatTurnPlan?: ChatTurnPlan | null;
  chatStyle?: ChatStyle | null;
  greetingPersona?: PickPersonaGreetingInput;
};

export type EllipsisRealismGuardResult = {
  chunks: string[];
  ellipsisCount: number;
  recentEllipsisRate: number;
  removedEllipsis: boolean;
  originalResponse: string;
  finalResponse: string;
};

export function countEllipsis(text: string): number {
  if (!text) return 0;
  const normalized = text.replace(SPACED_DOTS_RE, "...");
  const matches = normalized.match(ELLIPSIS_RE);
  return matches?.length ?? 0;
}

export function recentEllipsisRate(recentBotMessages: string[], window = 5): number {
  const slice = recentBotMessages.slice(0, window);
  if (!slice.length) return 0;
  const withEllipsis = slice.filter((m) => countEllipsis(m) > 0).length;
  return withEllipsis / slice.length;
}

function chunkIsSimpleNoEllipsis(chunk: string): boolean {
  const t = chunk.trim();
  if (t.length > 85) return false;
  return SIMPLE_NO_ELLIPSIS_RES.some((re) => re.test(t));
}

function intentDisallowsEllipsis(intent?: CombinedUserIntent, plan?: ChatTurnPlan | null): boolean {
  if (plan?.userIntent === "greeting_only") return true;
  if (intent && DISALLOW_ELLIPSIS_INTENTS.includes(intent)) return true;
  return false;
}

function personaPushesEllipsis(style?: ChatStyle | null): boolean {
  return style?.signature_quirk === "drie-puntjes-eind";
}

/** Strip ellipsis variants; light repair so the line still reads naturally. */
export function stripEllipsisFromText(text: string): string {
  let s = text.trim();
  if (!s) return s;

  s = s.replace(SPACED_DOTS_RE, " ");
  s = s.replace(/\.{2,}/g, " ");
  s = s.replace(/…+/g, " ");
  s = s.replace(/\s+\.\s+/g, " ");
  s = s.replace(/\s{2,}/g, " ").trim();

  // "goed zo en jij" → cleaner question
  if (/\ben\s+jij\b/i.test(s) && !/[?]/.test(s)) {
    s = s.replace(/\s*,?\s*en\s+jij\s*$/i, ", met jou?");
  }
  if (/\bgoed\s+zo\b/i.test(s)) {
    s = s.replace(/\bgoed\s+zo\b/gi, "gaat goed hoor");
  }
  if (/\bgoed\s+hoor,\s*en\s+met\s+jou\b/i.test(s)) {
    s = s.replace(/\bgoed\s+hoor,\s*en\s+met\s+jou\b/i, "gaat goed hoor");
  }

  // Trailing comma/space before ?
  s = s.replace(/,\s*\?/g, "?").replace(/\s+,/g, ",").trim();

  return s;
}

function repairBareGreetingAfterStrip(
  text: string,
  greetingPersona?: PickPersonaGreetingInput,
): string {
  if (!greetingPersona?.peerId) {
    if (/^\s*hoi\s*$/i.test(text)) return "hoi";
    if (/^\s*hey\s*$/i.test(text)) return "heyy";
    return text;
  }
  return repairBareGreetingChunk(text, greetingPersona);
}

function allowOneRareEllipsis(
  fullText: string,
  intent: CombinedUserIntent | undefined,
  recentRate: number,
  userMessage: string,
): boolean {
  if (intentDisallowsEllipsis(intent)) return false;
  if (recentRate >= 0.2) return false;
  if (countEllipsis(fullText) !== 1) return false;
  // Only when user teases silence / awkward — rare
  if (/\b(?:stil|weinig|typ|reageer|ghost)\b/i.test(userMessage)) return true;
  return false;
}

function processChunk(
  chunk: string,
  opts: {
    forceRemove: boolean;
    allowRareTrailing: boolean;
  },
): string {
  if (!countEllipsis(chunk) && !opts.forceRemove) return chunk;
  if (opts.allowRareTrailing && countEllipsis(chunk) === 1 && /\.\.\.\s*$/.test(chunk.trim())) {
    return chunk;
  }
  return stripEllipsisFromText(chunk);
}

export function applyEllipsisRealismGuard(
  input: EllipsisRealismGuardInput,
): EllipsisRealismGuardResult {
  const originalJoined = input.chunks.join("\n");
  const intent = input.combinedUserIntent;
  const plan = input.chatTurnPlan;
  const rate = recentEllipsisRate(input.recentBotMessages, 5);
  const totalEllipsis = countEllipsis(originalJoined);
  const disallow = intentDisallowsEllipsis(intent, plan);
  const recentHadEllipsis = rate > 0;
  const bubblesWithEllipsis = input.chunks.filter((c) => countEllipsis(c) > 0).length;

  let forceRemoveAll =
    disallow ||
    totalEllipsis > 1 ||
    bubblesWithEllipsis > 1 ||
    (recentHadEllipsis && totalEllipsis > 0) ||
    input.chunks.some((c) => chunkIsSimpleNoEllipsis(c) && countEllipsis(c) > 0);

  if (!forceRemoveAll && totalEllipsis > 0) {
    const userShort = (input.currentUserMessage ?? "").trim().length < 35;
    if (userShort && input.chunks.every((c) => c.trim().length < 90)) {
      forceRemoveAll = true;
    }
  }

  const allowRare =
    !forceRemoveAll &&
    allowOneRareEllipsis(originalJoined, intent, rate, input.currentUserMessage);

  let chunks = input.chunks.map((c) => {
    let out = processChunk(c, {
      forceRemove: forceRemoveAll || chunkIsSimpleNoEllipsis(c),
      allowRareTrailing: allowRare,
    });
    if (forceRemoveAll || countEllipsis(c) > 0) {
      out = repairBareGreetingAfterStrip(out, input.greetingPersona);
    }
    return out;
  });

  // Persona ellipsis quirk never bypasses guard
  if (personaPushesEllipsis(input.chatStyle) && countEllipsis(chunks.join("\n")) > 0 && !allowRare) {
    chunks = chunks.map((c) => stripEllipsisFromText(c));
    forceRemoveAll = true;
  }

  chunks = chunks.filter((c) => c.length > 0);
  const finalResponse = chunks.join("\n");
  const finalCount = countEllipsis(finalResponse);
  const removedEllipsis = finalCount < totalEllipsis || originalJoined !== finalResponse;

  const result: EllipsisRealismGuardResult = {
    chunks,
    ellipsisCount: finalCount,
    recentEllipsisRate: rate,
    removedEllipsis,
    originalResponse: originalJoined,
    finalResponse,
  };

  logEllipsisRealismGuardDev(result);
  return result;
}

export function logEllipsisRealismGuardDev(meta: EllipsisRealismGuardResult): void {
  if (process.env.NODE_ENV !== "development") return;
  console.info(
    "[ellipsis-realism-guard]",
    JSON.stringify(
      {
        ellipsis_count: meta.ellipsisCount,
        recent_ellipsis_rate: meta.recentEllipsisRate,
        removed_ellipsis: meta.removedEllipsis,
        original: meta.originalResponse.slice(0, 500),
        final: meta.finalResponse.slice(0, 500),
      },
      null,
      2,
    ),
  );
}
