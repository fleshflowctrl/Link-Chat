/**
 * Normalizes short user bursts into a single combined intent for reply shaping.
 */

import type { RecentTurn } from "@/lib/ai/conversation-state-guard";

export type CombinedUserIntent =
  | "greeting_plus_how_are_you"
  | "greeting_only"
  | "how_are_you"
  | "plans"
  | "flirt"
  | "compliment"
  | "ai_test"
  | "generic";

export type NormalizedUserIntent = {
  userGreetingOpen: boolean;
  userAskedHowAreYou: boolean;
  userAskedPlans: boolean;
  userFlirted: boolean;
  userComplimented: boolean;
  userAskedAiQuestion: boolean;
  combinedUserIntent: CombinedUserIntent;
  shouldBotGreet: boolean;
  shouldBotAskBack: boolean;
};

const GREETING_RE = /^(?:hoi|hey|heyy|hallo|ha|hoii|hee)\b/i;
const HOW_ARE_YOU_RE =
  /\b(?:hoe\s+gaat\s+(?:het|ie)|alles\s+goed|hoe\s+is\s+het|hoe\s+maak\s+je\s+het|goed\s+bij\s+jou|bij\s+jou)\b/i;
const HOW_ARE_YOU_RECIPROCAL_RE =
  /(?:^|[,.!?]\s*)(?:jij\??|en\s+jij\??|met\s+jou\??)\s*$/i;
const PLANS_RE =
  /\b(?:wat\s+ga\s+je|plannen|planning|vandaag\s+doen|wat\s+staat\s+er)\b/i;
const FLIRT_RE =
  /\b(?:jou|je)\s+app(?:en)?\b|\bmet jou\b|\bben je plan\b/i;
const COMPLIMENT_RE = /\bje ziet er|ziet er (?:goed|lekker)|mooi\b|\bknap\b/i;
const AI_RE =
  /\b(?:ben je|jij)\s+(?:echt|een)\s*(?:ai|bot)\b|\bai\s+of\s+echt\b/i;

const PEER_GREETING_RE =
  /\b(?:^|[.!?]\s*)(?:hoi|hey|heyy|hallo|goedemorgen|goedenavond)\b/i;

function normalizeLine(s: string): string {
  return s.trim().toLowerCase();
}

function burstWithinMinutes(
  timestamps: number[],
  maxMinutes: number,
): boolean {
  if (timestamps.length < 2) return true;
  const sorted = [...timestamps].sort((a, b) => a - b);
  const span = sorted[sorted.length - 1]! - sorted[0]!;
  return span <= maxMinutes * 60_000;
}

export function normalizeUserMessageIntent(input: {
  recentMessages: RecentTurn[];
  currentUserMessage: string;
  userBurstLines?: string[];
  userBurstTimestamps?: number[];
  recentPeerBodies?: string[];
  currentTimestamp?: number;
}): NormalizedUserIntent {
  const lines = (
    input.userBurstLines?.map((l) => l.trim()).filter(Boolean) ??
    input.currentUserMessage
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean)
  );

  const userGreetingOpen = lines.some((l) => GREETING_RE.test(l));
  const userAskedHowAreYou =
    lines.some((l) => HOW_ARE_YOU_RE.test(l) || HOW_ARE_YOU_RECIPROCAL_RE.test(l)) ||
    HOW_ARE_YOU_RE.test(input.currentUserMessage) ||
    HOW_ARE_YOU_RECIPROCAL_RE.test(input.currentUserMessage);
  const userAskedPlans = lines.some((l) => PLANS_RE.test(l));
  const userFlirted = lines.some((l) => FLIRT_RE.test(l)) || FLIRT_RE.test(input.currentUserMessage);
  const userComplimented =
    lines.some((l) => COMPLIMENT_RE.test(l)) || COMPLIMENT_RE.test(input.currentUserMessage);
  const userAskedAiQuestion =
    lines.some((l) => AI_RE.test(l)) || AI_RE.test(input.currentUserMessage);

  const burstClose =
    !input.userBurstTimestamps?.length ||
    burstWithinMinutes(input.userBurstTimestamps, 2);

  let combinedUserIntent: CombinedUserIntent = "generic";
  if (userAskedAiQuestion) combinedUserIntent = "ai_test";
  else if (userComplimented) combinedUserIntent = "compliment";
  else if (userFlirted) combinedUserIntent = "flirt";
  else if (userGreetingOpen && userAskedHowAreYou && burstClose) {
    combinedUserIntent = "greeting_plus_how_are_you";
  } else if (userGreetingOpen && lines.length <= 2) {
    combinedUserIntent = "greeting_only";
  } else if (userAskedHowAreYou) {
    combinedUserIntent = "how_are_you";
  } else if (userAskedPlans) {
    combinedUserIntent = "plans";
  }

  const peerRecent = (input.recentPeerBodies ?? []).slice(0, 3);
  const botAlreadyGreeted = peerRecent.some((b) => PEER_GREETING_RE.test(b));

  const shouldBotGreet =
    !botAlreadyGreeted &&
    (combinedUserIntent === "greeting_only" ||
      combinedUserIntent === "greeting_plus_how_are_you" ||
      (userGreetingOpen && !userAskedHowAreYou));

  const shouldBotAskBack =
    userAskedHowAreYou &&
    combinedUserIntent !== "greeting_only" &&
    !userAskedPlans;

  return {
    userGreetingOpen,
    userAskedHowAreYou,
    userAskedPlans,
    userFlirted,
    userComplimented,
    userAskedAiQuestion,
    combinedUserIntent,
    shouldBotGreet,
    shouldBotAskBack,
  };
}
