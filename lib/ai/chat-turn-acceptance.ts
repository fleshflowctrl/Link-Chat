/**
 * Acceptance fixtures for ChatTurnPlan + Final Coherence (manual / CI).
 * Run: npx tsx scripts/run-chat-acceptance.ts (add script) or import in dev route.
 */

import { buildChatTurnPlan, type BuildChatTurnPlanInput } from "@/lib/ai/chat-turn-plan";
import { fallbackResponseForPlan } from "@/lib/ai/chat-turn-fallbacks";
import { applyFinalCoherenceValidator } from "@/lib/ai/final-coherence-validator";
import type { RecentTurn } from "@/lib/ai/conversation-state-guard";

export type AcceptanceCase = {
  id: string;
  description: string;
  recentMessages: RecentTurn[];
  userBurstLines: string[];
  badCandidate: string;
  expectIntent?: string;
  expectValidAfterFallback?: boolean;
  expectNotContaining?: string[];
};

export const ACCEPTANCE_CASES: AcceptanceCase[] = [
  {
    id: "1-greeting-only",
    description: 'User: "hoi" — short greeting only',
    recentMessages: [],
    userBurstLines: ["hoi"],
    badCandidate: "lekker relaxed aan het",
    expectIntent: "greeting_only",
    expectNotContaining: ["lunchen", "hoe ziet", "dag eruit"],
  },
  {
    id: "2-greeting-how-are-you",
    description: 'User: "hoi" + "hoe gaat het?"',
    recentMessages: [],
    userBurstLines: ["hoi", "hoe gaat het?"],
    badCandidate: "😊 hoe gaat je op deze vrijdag?\n<<<>>>\nhoi 😊 gaat prima",
    expectIntent: "greeting_plus_how_are_you",
    expectNotContaining: ["hoe gaat je op deze vrijdag", "hoe ziet jouw dag"],
  },
  {
    id: "3-just-ate",
    description: "Bot net gegeten, user vraagt hoe het gaat",
    recentMessages: [
      { sender: "peer", body: "ook prima hier, net ff wat gegeten" },
      { sender: "user", body: "goed rustig aan, jij?" },
    ],
    userBurstLines: ["goed rustig aan, jij?"],
    badCandidate: "relaxed klinkt goed, ik ben net aan het lunchen hier",
    expectNotContaining: ["net aan het lunchen"],
  },
  {
    id: "4-flirt-after-free",
    description: "User vrij → flirt jou appen",
    recentMessages: [
      { sender: "user", body: "oh lekker, ik ben vrij vandaag" },
      { sender: "peer", body: "wat ga je ermee doen" },
      { sender: "user", body: "jou appen" },
    ],
    userBurstLines: ["jou appen"],
    badCandidate: "hoe ziet jouw dag eruit vandaag?",
    expectIntent: "flirt",
    expectNotContaining: ["wat ga je vandaag", "hoe ziet jouw dag"],
  },
  {
    id: "5-plans-and-ai",
    description: "Plans + AI test",
    recentMessages: [],
    userBurstLines: ["jij nog plannen vandaag?", "ben je echt of ai?"],
    badCandidate: "hoe ziet jouw dag eruit",
    expectNotContaining: ["hoe ziet jouw dag"],
  },
  {
    id: "6-flirt-appen",
    description: "met jou aan het appen",
    recentMessages: [],
    userBurstLines: ["met jou aan het appen"],
    badCandidate: "fijne start van de dag, wat doe je?",
    expectIntent: "flirt",
    expectNotContaining: ["fijne start", "wat doe je"],
  },
  {
    id: "7-how-are-you-user",
    description: "goed bij jou?",
    recentMessages: [],
    userBurstLines: ["goed bij jou?"],
    badCandidate: "hoe ziet jouw dag eruit tot nu toe",
    expectNotContaining: ["hoe ziet jouw dag"],
  },
];

function baseInput(
  c: AcceptanceCase,
): Omit<BuildChatTurnPlanInput, "recentMessages"> & { recentMessages: RecentTurn[] } {
  return {
    recentMessages: c.recentMessages,
    currentUserMessage: c.userBurstLines.join("\n"),
    userBurstLines: c.userBurstLines,
    userBurstTimestamps: c.userBurstLines.map((_, i) => Date.now() - (c.userBurstLines.length - i) * 30_000),
  };
}

export type AcceptanceResult = {
  id: string;
  passed: boolean;
  errors: string[];
  planIntent: string;
  coherenceValid: boolean;
  finalText: string;
};

export async function runAcceptanceChecks(): Promise<AcceptanceResult[]> {
  const results: AcceptanceResult[] = [];

  for (const c of ACCEPTANCE_CASES) {
    const errors: string[] = [];
    const plan = buildChatTurnPlan(baseInput(c));

    if (c.expectIntent && plan.userIntent !== c.expectIntent) {
      errors.push(`intent: expected ${c.expectIntent}, got ${plan.userIntent}`);
    }

    const coherence = await applyFinalCoherenceValidator({
      chatTurnPlan: plan,
      candidateBotResponse: c.badCandidate,
      recentMessages: c.recentMessages,
      currentUserMessage: c.userBurstLines.join("\n"),
    });

    const finalText = coherence.text;
    for (const phrase of c.expectNotContaining ?? []) {
      if (finalText.toLowerCase().includes(phrase.toLowerCase())) {
        errors.push(`final still contains: ${phrase}`);
      }
    }

    if (c.id === "1-greeting-only" && finalText.length > 60) {
      errors.push("greeting reply too long");
    }

    results.push({
      id: c.id,
      passed: errors.length === 0,
      errors,
      planIntent: plan.userIntent,
      coherenceValid: coherence.valid || coherence.corrected,
      finalText,
    });
  }

  return results;
}
