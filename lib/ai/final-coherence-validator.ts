/**
 * Single post-Grok coherence pass — validates full response against ChatTurnPlan.
 * One rule-based correction (+ optional LLM); replaces stacked independent rewrites.
 */

import type { ChatTurnPlan } from "@/lib/ai/chat-turn-plan";
import {
  fallbackResponseForPlan,
  type FallbackPersonaContext,
} from "@/lib/ai/chat-turn-fallbacks";
import type { RecentTurn } from "@/lib/ai/conversation-state-guard";
import { validateChatQuality } from "@/lib/ai/chat-quality-gate";
import {
  filterQualityReasonsForGreeting,
  isValidGreetingOnlyBotReply,
} from "@/lib/ai/persona-greeting-style";
import { validateSessionFactConsistency } from "@/lib/ai/session-fact-consistency-guard";
import {
  extractBotSessionFacts,
  type BotSessionFacts,
} from "@/lib/ai/session-fact-consistency-guard";
import { MULTI_MESSAGE_SEPARATOR, splitMultiMessage } from "@/lib/ai/post-process-reply";
import { grokResponsesComplete } from "@/lib/xai/grok-responses";

const FRAGMENT_START_RES = [
  /^lekker\s+(?:rustig|relaxed)\s+aan\s+het\b/i,
  /^relaxed\s+aan\s+het\b/i,
  /^net\s+(?:even\s+)?aan\s+het\b/i,
  /^beetje\s+bezig\s+met\b/i,
];

const INCOMPLETE_END_RE =
  /\b(?:aan\s+het|bezig\s+met|met|voor|om|dus|maar)\s*[,.!…]*\s*$/i;

const BROKEN_WORD_RE = /\b(?:hoegaat|pirma|watt|egt)\b/i;

const ACTIVITY_RE =
  /\b(?:net\s+aan\s+het\s+lunchen|aan\s+het\s+lunchen|aan\s+het\s+eten|lekker\s+rustig\s+aan\s+het|zit\s+ff\s+op\s+de\s+bank|onderweg\s+naar\s+werk)\b/i;

const GREETING_RE = /^(?:hoi|hey|heyy|hallo|goedemorgen|yo|hee|haa?ai)\b/i;

function meaningfulLength(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

function countEmojis(text: string): number {
  const re = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]/g;
  return (text.match(re) ?? []).length;
}

export type FinalCoherenceInput = {
  chatTurnPlan: ChatTurnPlan;
  candidateBotResponse: string;
  recentMessages: RecentTurn[];
  currentUserMessage: string;
  personaName?: string;
  personaCtx?: FallbackPersonaContext;
};

export type FinalCoherenceResult = {
  valid: boolean;
  reasons: string[];
  text: string;
  corrected: boolean;
};

function validateAgainstPlan(
  text: string,
  plan: ChatTurnPlan,
  recentMessages: RecentTurn[],
  currentUserMessage: string,
): string[] {
  const reasons: string[] = [];
  const t = text.trim();
  const chunks = splitMultiMessage(t, plan.maxBubbles + 1);
  const session = extractBotSessionFacts(recentMessages);

  if (!t) reasons.push("empty");

  for (const phrase of plan.shouldNotAsk) {
    if (t.toLowerCase().includes(phrase.toLowerCase())) {
      reasons.push(`should_not_ask:${phrase}`);
    }
  }

  for (const move of plan.bannedMoves) {
    if (move.includes("fragment") && FRAGMENT_START_RES.some((re) => re.test(chunks[0] ?? t))) {
      reasons.push("fragment_start");
    }
    if (move.includes("double greeting")) {
      const greetCount = chunks.filter((c) => GREETING_RE.test(c.trim())).length;
      if (greetCount > 1) reasons.push("double_greeting");
    }
    if (move.includes("random activity") && !plan.canIntroduceBotActivity && ACTIVITY_RE.test(t)) {
      reasons.push("random_activity");
    }
  }

  if (!plan.canIntroduceBotActivity && ACTIVITY_RE.test(t) && !/\b(?:wat\s+doe|bezig)\b/i.test(currentUserMessage)) {
    reasons.push("activity_not_allowed");
  }

  if (BROKEN_WORD_RE.test(t)) reasons.push("broken_dutch");
  if (INCOMPLETE_END_RE.test(t)) reasons.push("incomplete_end");
  for (const c of chunks) {
    if (FRAGMENT_START_RES.some((re) => re.test(c))) reasons.push("fragment_chunk");
  }

  if (t.length > plan.maxTotalChars + 40) reasons.push("too_long_for_plan");

  if (plan.userIntent === "greeting_only") {
    if (ACTIVITY_RE.test(t)) reasons.push("greeting_only_has_activity");
    if (!isValidGreetingOnlyBotReply(t)) {
      if (FRAGMENT_START_RES.some((re) => re.test(chunks[0] ?? t))) {
        reasons.push("invalid_greeting_only_fragment");
      } else if (t.length > 55 || meaningfulLength(t) > 12) {
        reasons.push("invalid_greeting_only");
      }
    }
  }

  if (plan.userIntent === "greeting_plus_how_are_you") {
    if (!/\b(?:gaat|prima|goed|wel|ok|rustig|chill)\b/i.test(t)) {
      reasons.push("missing_how_are_you_answer");
    }
    if (/\bhoe gaat je(?:r| op| hier| vandaag| deze)\b/i.test(t)) {
      reasons.push("echo_how_are_you_question");
    }
    const greetWords = (t.match(/\b(?:hoi|hey|heyy|hallo)\b/gi) ?? []).length;
    if (greetWords > 1) reasons.push("double_greeting_words");
    const first = (chunks[0] ?? t).trim();
    if (/^\s*(?:[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF])*\s*hoe gaat je\b/i.test(first)) {
      reasons.push("opens_with_echo_question");
    }
  }

  if (plan.userIntent === "flirt" && !/\b(?:smooth|plan|app|jij|leuk|grappig|haha)\b/i.test(t)) {
    reasons.push("flirt_not_addressed");
  }

  if (plan.userIntent === "ai_test" && !/\b(?:ai|bot|echt|nep)\b/i.test(t)) {
    reasons.push("ai_test_ignored");
  }

  const sessionVal = validateSessionFactConsistency(t, session, recentMessages);
  if (!sessionVal.valid) reasons.push(...sessionVal.invalidReasons.map((r) => `session:${r}`));

  const qualityVal = validateChatQuality({
    currentUserMessage,
    candidateBotResponse: t,
    recentMessages,
    normalizedIntent: plan.normalizedIntent,
    persona: { name: "peer" },
    sessionFacts: session,
  });
  const qualityReasons = filterQualityReasonsForGreeting(
    qualityVal.reasons,
    t,
    currentUserMessage,
  );
  if (qualityReasons.length > 0) {
    reasons.push(...qualityReasons.map((r) => `quality:${r}`));
  }

  let out = Array.from(new Set(reasons));
  if (plan.userIntent === "greeting_only" && isValidGreetingOnlyBotReply(t)) {
    out = out.filter(
      (r) =>
        !r.startsWith("quality:greeting_only") &&
        !r.startsWith("quality:too_short") &&
        r !== "invalid_greeting_only",
    );
  }

  if (countEmojis(t) > 2) out.push("too_many_emoji");

  return Array.from(new Set(out));
}

export function isFinalCoherenceLlmEnabled(): boolean {
  const raw = process.env.XAI_FINAL_COHERENCE_LLM?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

async function llmRewriteOnce(
  candidate: string,
  plan: ChatTurnPlan,
  currentUserMessage: string,
  personaName: string,
): Promise<string | null> {
  const out = await grokResponsesComplete(
    [
      {
        role: "system",
        content: [
          `Herschrijf één dating-app antwoord (${personaName}, Nederlands).`,
          "Volg het ChatTurnPlan EXACT.",
          `Intent: ${plan.userIntent}`,
          `Moet beantwoorden: ${plan.mustAnswer.join("; ")}`,
          `Niet vragen: ${plan.shouldNotAsk.join("; ")}`,
          `Max ${plan.maxBubbles} bubbels met <<<>>> ertussen.`,
          `Max ~${plan.maxTotalChars} tekens.`,
          `Groeten: ${plan.shouldGreet ? "max 1x" : "nee"}`,
          `Activiteit: ${plan.canIntroduceBotActivity ? "kort ok" : "nee"}`,
          "Geen hoegaat/pirma/egt. Weinig emoji.",
        ].join(" "),
      },
      {
        role: "user",
        content: `User:\n${currentUserMessage}\n\nCandidate:\n${candidate}\n\nRewrite:`,
      },
    ],
    { temperature: 0.4, maxOutputTokens: 400 },
  );
  if (!out.ok || !out.text.trim()) return null;
  return out.text.trim();
}

export async function applyFinalCoherenceValidator(
  input: FinalCoherenceInput,
): Promise<FinalCoherenceResult> {
  const original = input.candidateBotResponse.trim();
  let reasons = validateAgainstPlan(
    original,
    input.chatTurnPlan,
    input.recentMessages,
    input.currentUserMessage,
  );

  if (reasons.length === 0) {
    return { valid: true, reasons: [], text: original, corrected: false };
  }

  let corrected = fallbackResponseForPlan(input.chatTurnPlan, input.personaCtx);
  let recheck = validateAgainstPlan(
    corrected,
    input.chatTurnPlan,
    input.recentMessages,
    input.currentUserMessage,
  );

  if (
    recheck.length > 0 &&
    isFinalCoherenceLlmEnabled() &&
    process.env.XAI_API_KEY?.trim()
  ) {
    try {
      const llm = await llmRewriteOnce(
        original,
        input.chatTurnPlan,
        input.currentUserMessage,
        input.personaName ?? "persona",
      );
      if (llm) {
        corrected = llm;
        recheck = validateAgainstPlan(
          corrected,
          input.chatTurnPlan,
          input.recentMessages,
          input.currentUserMessage,
        );
      }
    } catch {
      /* keep fallback */
    }
  }

  if (recheck.length > 0) {
    corrected = fallbackResponseForPlan(input.chatTurnPlan);
    recheck = validateAgainstPlan(
      corrected,
      input.chatTurnPlan,
      input.recentMessages,
      input.currentUserMessage,
    );
  }

  return {
    valid: recheck.length === 0,
    reasons,
    text: corrected.trim(),
    corrected: corrected.trim() !== original,
  };
}
