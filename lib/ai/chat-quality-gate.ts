/**
 * Global Chat Quality Gate — final validator for all personas.
 * Ensures intent match, complete sentences, no random activity on greeting-only turns.
 */

import type { RecentTurn } from "@/lib/ai/conversation-state-guard";
import type { NormalizedUserIntent } from "@/lib/ai/message-intent-normalizer";
import type { BotSessionFacts } from "@/lib/ai/session-fact-consistency-guard";
import {
  MULTI_MESSAGE_SEPARATOR,
  splitMultiMessage,
} from "@/lib/ai/post-process-reply";
import { grokResponsesComplete } from "@/lib/xai/grok-responses";
import {
  chunkLooksLikeValidGreeting as personaChunkValidGreeting,
  filterQualityReasonsForGreeting,
  isValidGreetingOnlyBotReply,
  pickNonRepeatingPersonaGreeting,
  type PickPersonaGreetingInput,
} from "@/lib/ai/persona-greeting-style";

export type ChatQualityPersona = {
  name: string;
  flirtLevel?: "low" | "medium" | "high" | "explicit";
};

export type ChatQualityGateInput = {
  currentUserMessage: string;
  recentMessages: RecentTurn[];
  candidateBotResponse: string;
  normalizedIntent: NormalizedUserIntent;
  persona?: ChatQualityPersona;
  sessionFacts?: BotSessionFacts | null;
  /** Persona-aware greeting fallback selection */
  greetingPersona?: PickPersonaGreetingInput;
};

export type ChatQualityGateResult = {
  isValid: boolean;
  reasons: string[];
  correctedResponse: string;
  chunks: string[];
  guardApplied: boolean;
};

const GREETING_ONLY_USER_RE =
  /^(?:hoi|hey|heyy|hallo|ha|hoii|hee|goedemorgen|goedenavond|goeiemorgen)\s*[!.?…]*\s*$/i;

const VALID_GREETING_RESPONSE_RE =
  /^(?:heyy?|hoi|hey|hallo|haa?ai|yo|hee|hoihoi|ja\s+hallo|goeiemorgen|goedenavond|goedemiddag)(?:\s+jij)?(?:[,.!]?\s*(?:alles\s+goed|hoe\s+is\s+het|jij))?\s*[!.?…]*\s*$/i;

const FRAGMENT_START_RES: RegExp[] = [
  /^lekker\s+(?:rustig|relaxed)\s+aan\s+het\b/i,
  /^relaxed\s+aan\s+het\b/i,
  /^net\s+(?:even\s+)?aan\s+het\b/i,
  /^beetje\s+bezig\s+met\b/i,
  /^ik\s+was\s+net\b/i,
  /^ook\s+prima\b/i,
  /^gaat\s+prima\b/i,
];

const INCOMPLETE_END_RE =
  /\b(?:aan\s+het|bezig\s+met|net\s+aan\s+het|zit\s+ff|was\s+net)\s*[,.!…]*\s*$/i;

const DANGLING_END_RE = /\b(?:met|voor|om|dus|maar|en|of)\s*[,.!…]*\s*$/i;

const ACTIVITY_INJECTION_RES: RegExp[] = [
  /\b(?:ben\s+)?net\s+aan\s+het\s+(?:lunchen|eten|werken)\b/i,
  /\b(?:lekker\s+)?(?:rustig|relaxed)\s+aan\s+het\b/i,
  /\bzit\s+ff\s+op\s+de\s+bank\b/i,
  /\bnet\s+even\s+(?:wat\s+)?gegeten\b/i,
  /\b(?:ff\s+)?aan\s+het\s+lunchen\b/i,
  /\bop\s+werk\b/i,
  /\bonderweg\s+naar\b/i,
];

const GENERIC_DAY_OPENING_RES: RegExp[] = [
  /\bhoe\s+gaat\s+jouw\s+(?:vrijdag|dag|week)\b/i,
  /\bhoe\s+ziet\s+jouw\s+(?:dag|vrijdag)\b/i,
  /\bwat\s+ben\s+jij\s+(?:allemaal\s+)?aan\s+het\s+doen\b/i,
  /\bwat\s+ga\s+je\s+(?:vandaag\s+)?doen\b/i,
];

const USER_ASKED_ACTIVITY_RE =
  /\b(?:wat\s+doe\s+je|waar\s+ben\s+je|bezig\s+met|aan\s+het\s+doen)\b/i;

const VALID_SHORT_REACTIONS = new Set([
  "heyy",
  "hey",
  "hoi",
  "hallo",
  "ja",
  "nee",
  "ok",
  "oke",
  "haha",
  "lol",
  "hm",
  "hmm",
]);

function joinResponse(chunks: string[]): string {
  if (chunks.length <= 1) return chunks[0] ?? "";
  return chunks.join(`\n${MULTI_MESSAGE_SEPARATOR}\n`);
}

function toChunks(text: string, maxChunks = 4): string[] {
  return splitMultiMessage(text.trim(), maxChunks);
}

function meaningfulWordCount(text: string): number {
  return text
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .length;
}

function isGreetingOnlyUser(message: string, intent: NormalizedUserIntent): boolean {
  const m = message.trim();
  if (intent.combinedUserIntent === "greeting_only") return true;
  if (GREETING_ONLY_USER_RE.test(m)) return true;
  const lines = m.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  return lines.length === 1 && GREETING_ONLY_USER_RE.test(lines[0]!);
}

function chunkLooksLikeValidGreeting(chunk: string): boolean {
  if (personaChunkValidGreeting(chunk)) return true;
  const t = chunk.trim();
  if (VALID_GREETING_RESPONSE_RE.test(t)) return true;
  const lower = t.toLowerCase().replace(/[^\w\s]/g, "").trim();
  return VALID_SHORT_REACTIONS.has(lower) || /^(?:hoi|hey|heyy)\s+jij$/i.test(t);
}

function userAskedActivity(message: string, intent: NormalizedUserIntent): boolean {
  return (
    USER_ASKED_ACTIVITY_RE.test(message) ||
    intent.userAskedPlans ||
    intent.combinedUserIntent === "plans"
  );
}

function botRecentlyMentionedActivity(
  recentMessages: RecentTurn[],
  sessionFacts?: BotSessionFacts | null,
): boolean {
  const peerRecent = recentMessages
    .filter((t) => t.sender === "peer")
    .slice(-3)
    .map((t) => t.body);
  if (peerRecent.some((b) => ACTIVITY_INJECTION_RES.some((re) => re.test(b)))) {
    return true;
  }
  if (sessionFacts && sessionFacts.bot_current_activity !== "unknown") {
    return true;
  }
  return false;
}

export function validateChatQuality(input: ChatQualityGateInput): {
  isValid: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  const text = input.candidateBotResponse.trim();
  const user = input.currentUserMessage.trim();
  const intent = input.normalizedIntent;

  if (!text) {
    return { isValid: false, reasons: ["empty_response"] };
  }

  const chunks = toChunks(text);
  const first = chunks[0] ?? text;

  if (isGreetingOnlyUser(user, intent)) {
    if (isValidGreetingOnlyBotReply(text)) {
      /* Grok/pipeline output is already a valid short greeting — keep it */
    } else {
      const anyValidGreet = chunks.some((c) => chunkLooksLikeValidGreeting(c));
      if (!anyValidGreet) {
        reasons.push("greeting_only_user_needs_greeting_reply");
      }
    }
    for (const c of chunks) {
      if (ACTIVITY_INJECTION_RES.some((re) => re.test(c))) {
        reasons.push("activity_on_greeting_only");
        break;
      }
      if (GENERIC_DAY_OPENING_RES.some((re) => re.test(c))) {
        reasons.push("generic_day_question_on_greeting_only");
        break;
      }
    }
    if (chunks.length > 2) {
      reasons.push("too_many_bubbles_on_greeting_only");
    }
  }

  if (
    intent.combinedUserIntent === "how_are_you" ||
    intent.combinedUserIntent === "greeting_plus_how_are_you"
  ) {
    if (
      isGreetingOnlyUser(user.split("\n")[0] ?? user, {
        ...intent,
        combinedUserIntent: "greeting_only",
      }) === false
    ) {
      /* full intent handled elsewhere */
    }
  }

  for (const c of chunks) {
    for (const re of FRAGMENT_START_RES) {
      if (re.test(c.trim())) {
        reasons.push(`fragment_start:${c.slice(0, 30)}`);
        break;
      }
    }
    if (INCOMPLETE_END_RE.test(c) || DANGLING_END_RE.test(c)) {
      reasons.push(`incomplete_end:${c.slice(0, 30)}`);
    }
    const words = meaningfulWordCount(c);
    if (words < 3 && !chunkLooksLikeValidGreeting(c) && c.length > 2) {
      const lower = c.toLowerCase().replace(/[^\w\s]/g, "").trim();
      if (!VALID_SHORT_REACTIONS.has(lower)) {
        reasons.push(`too_short_incomplete:${c.slice(0, 30)}`);
      }
    }
  }

  if (
    !userAskedActivity(user, intent) &&
    !botRecentlyMentionedActivity(input.recentMessages, input.sessionFacts)
  ) {
    for (const c of chunks) {
      if (ACTIVITY_INJECTION_RES.some((re) => re.test(c))) {
        reasons.push("context_free_activity");
        break;
      }
    }
  }

  if (
    isGreetingOnlyUser(user, intent) &&
    first.length > 60 &&
    !chunkLooksLikeValidGreeting(first)
  ) {
    reasons.push("greeting_reply_too_long");
  }

  const unique = Array.from(new Set(reasons));
  const filtered = filterQualityReasonsForGreeting(unique, text, user);
  return { isValid: filtered.length === 0, reasons: filtered };
}

function templateCorrection(
  intent: NormalizedUserIntent,
  userMessage: string,
  persona?: ChatQualityPersona,
  greetingPersona?: PickPersonaGreetingInput,
): string {
  const sep = `\n${MULTI_MESSAGE_SEPARATOR}\n`;

  if (intent.combinedUserIntent === "greeting_plus_how_are_you") {
    return ["gaat prima eigenlijk", "met jou?"].join(sep);
  }
  if (intent.combinedUserIntent === "how_are_you") {
    return intent.shouldBotAskBack
      ? ["gaat wel eigenlijk", "jij?"].join(sep)
      : "gaat wel eigenlijk";
  }
  if (isGreetingOnlyUser(userMessage, intent) || intent.combinedUserIntent === "greeting_only") {
    if (greetingPersona?.peerId) {
      return pickNonRepeatingPersonaGreeting({
        ...greetingPersona,
        userMessage,
      });
    }
    return intent.shouldBotGreet ? "heyy" : "hey";
  }
  if (USER_ASKED_ACTIVITY_RE.test(userMessage) || intent.userAskedPlans) {
    return ["niet veel eigenlijk", "beetje niks aan het doen"].join(sep);
  }
  if (intent.combinedUserIntent === "flirt") {
    return ["haha smooth", "werkt misschien een beetje"].join(sep);
  }
  if (intent.combinedUserIntent === "compliment") {
    return "haha smooth hoor";
  }
  if (intent.userAskedAiQuestion) {
    return ["haha ai-test meteen", "nee gewoon irritant hier"].join(sep);
  }
  return "heyy";
}

function ruleBasedCorrect(input: ChatQualityGateInput): string {
  return templateCorrection(
    input.normalizedIntent,
    input.currentUserMessage,
    input.persona,
    input.greetingPersona,
  );
}

export function isChatQualityGateLlmEnabled(): boolean {
  const raw = process.env.XAI_CHAT_QUALITY_GATE_LLM?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

async function llmCorrect(input: ChatQualityGateInput): Promise<string | null> {
  const recentBlock = input.recentMessages
    .map((t) => `${t.sender === "user" ? "User" : "Bot"}: ${t.body}`)
    .join("\n");

  const out = await grokResponsesComplete(
    [
      {
        role: "system",
        content: [
          "Rewrite this Dutch dating-app bot reply.",
          "Directly and naturally answer the user's latest message.",
          "Short, casual, coherent. No random activities unless user asked.",
          "No generic day/plans questions unless appropriate.",
          "Max one emoji. Complete sentences only — no fragments.",
          "Optional <<<>>> between short bubbles.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          `User intent: ${input.normalizedIntent.combinedUserIntent}`,
          `Latest user: ${input.currentUserMessage}`,
          "",
          "Recent:",
          recentBlock,
          "",
          "Invalid candidate:",
          input.candidateBotResponse,
          "",
          "Rewrite:",
        ].join("\n"),
      },
    ],
    { temperature: 0.45, maxOutputTokens: 400 },
  );

  if (!out.ok || !out.text.trim()) return null;
  return out.text.trim();
}

export function logChatQualityGateDev(meta: {
  currentUserMessage: string;
  detectedIntent: string;
  candidateBotResponse: string;
  qualityGateValid: boolean;
  invalidReasons: string[];
  correctedResponse: string;
  finalResponse: string;
}): void {
  if (process.env.NODE_ENV !== "development") return;
  console.info(
    "[chat-quality-gate]",
    JSON.stringify(
      {
        current_user_message: meta.currentUserMessage.slice(0, 200),
        detected_intent: meta.detectedIntent,
        quality_gate_valid: meta.qualityGateValid,
        invalid_reasons: meta.invalidReasons,
        candidate: meta.candidateBotResponse.slice(0, 500),
        corrected: meta.correctedResponse.slice(0, 500),
        final: meta.finalResponse.slice(0, 500),
      },
      null,
      2,
    ),
  );
}

/** Validate + correct full response text; returns chunks ready for insert. */
export async function applyChatQualityGate(
  chunks: string[],
  input: Omit<ChatQualityGateInput, "candidateBotResponse">,
): Promise<ChatQualityGateResult> {
  const candidateBotResponse = joinResponse(chunks);
  const fullInput: ChatQualityGateInput = {
    ...input,
    candidateBotResponse,
  };

  const validation = validateChatQuality(fullInput);
  const original = candidateBotResponse;

  if (validation.isValid) {
    logChatQualityGateDev({
      currentUserMessage: input.currentUserMessage,
      detectedIntent: input.normalizedIntent.combinedUserIntent,
      candidateBotResponse: original,
      qualityGateValid: true,
      invalidReasons: [],
      correctedResponse: original,
      finalResponse: original,
    });
    return {
      isValid: true,
      reasons: [],
      correctedResponse: original,
      chunks,
      guardApplied: false,
    };
  }

  let corrected = ruleBasedCorrect(fullInput);
  let recheck = validateChatQuality({
    ...fullInput,
    candidateBotResponse: corrected,
  });

  if (
    !recheck.isValid &&
    isChatQualityGateLlmEnabled() &&
    process.env.XAI_API_KEY?.trim()
  ) {
    try {
      const llm = await llmCorrect(fullInput);
      if (llm) {
        corrected = llm;
        recheck = validateChatQuality({
          ...fullInput,
          candidateBotResponse: corrected,
        });
      }
    } catch {
      /* keep rule-based */
    }
  }

  if (!recheck.isValid) {
    corrected = ruleBasedCorrect(fullInput);
  }

  const outChunks = toChunks(corrected).filter((c) => c.length > 0);

  logChatQualityGateDev({
    currentUserMessage: input.currentUserMessage,
    detectedIntent: input.normalizedIntent.combinedUserIntent,
    candidateBotResponse: original,
    qualityGateValid: false,
    invalidReasons: validation.reasons,
    correctedResponse: corrected,
    finalResponse: joinResponse(outChunks),
  });

  return {
    isValid: recheck.isValid,
    reasons: validation.reasons,
    correctedResponse: corrected,
    chunks: outChunks.length > 0 ? outChunks : ["heyy"],
    guardApplied: joinResponse(outChunks) !== original,
  };
}
