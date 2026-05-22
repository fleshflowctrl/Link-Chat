/**
 * Acceptance: greeting fallbacks must vary across personas, not all "hoi jij".
 */

import { buildChatTurnPlan } from "@/lib/ai/chat-turn-plan";
import { fallbackResponseForPlan } from "@/lib/ai/chat-turn-fallbacks";
import {
  isValidGreetingOnlyBotReply,
  pickNonRepeatingPersonaGreeting,
} from "@/lib/ai/persona-greeting-style";
import { validateChatQuality } from "@/lib/ai/chat-quality-gate";
import { normalizeUserMessageIntent } from "@/lib/ai/message-intent-normalizer";

const PERSONA_FIXTURES = [
  { peerId: "p1", name: "Sofia", vibe: ["caring", "chill"], flirt: "low" as const },
  { peerId: "p2", name: "Lotte", vibe: ["playful", "romantic"], flirt: "high" as const },
  { peerId: "p3", name: "Emma", vibe: ["witty"], flirt: "medium" as const },
  { peerId: "p4", name: "Noor", vibe: ["gym"], flirt: "low" as const, age: 42 },
  { peerId: "p5", name: "Iris", vibe: ["coffee", "travel"], flirt: "medium" as const },
  { peerId: "p6", name: "Fleur", vibe: ["playful"], flirt: "explicit" as const },
  { peerId: "p7", name: "Mila", vibe: ["caring"], flirt: "low" as const, age: 45 },
  { peerId: "p8", name: "Zoë", vibe: ["movies"], flirt: "medium" as const },
  { peerId: "p9", name: "Lisa", vibe: ["romantic"], flirt: "high" as const },
  { peerId: "p10", name: "Anna", vibe: ["active"], flirt: "low" as const },
];

export async function runGreetingVariationAcceptance(): Promise<{
  passed: boolean;
  errors: string[];
  greetings: string[];
}> {
  const errors: string[] = [];
  const greetings: string[] = [];

  for (const p of PERSONA_FIXTURES) {
    const plan = buildChatTurnPlan({
      recentMessages: [],
      currentUserMessage: "hoi",
      userBurstLines: ["hoi"],
    });
    const ctx = {
      peerId: p.peerId,
      conversationId: p.peerId,
      personaName: p.name,
      vibeTags: p.vibe,
      flirtLevel: p.flirt,
      age: p.age ?? 26,
      userMessage: "hoi",
      recentBotMessages: [],
      seedSalt: p.peerId,
    };
    const g = fallbackResponseForPlan(plan, ctx);
    greetings.push(g);
  }

  const unique = new Set(greetings);
  if (unique.size < 4) {
    errors.push(`only ${unique.size} unique greetings across 10 personas (need >= 4)`);
  }

  const hoiJijCount = greetings.filter((g) => g.toLowerCase() === "hoi jij").length;
  if (hoiJijCount > 2) {
    errors.push(`"hoi jij" appears ${hoiJijCount}/10 times (max 2)`);
  }

  const counts = new Map<string, number>();
  for (const g of greetings) {
    counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  for (const [g, n] of Array.from(counts.entries())) {
    if (n > 3) errors.push(`"${g}" repeated ${n} times (>3)`);
  }

  // Valid Grok-like replies must pass quality without fallback
  const validSamples = ["heyy", "hoi", "hey, alles goed?", "yo", "haaai"];
  const intent = normalizeUserMessageIntent({
    recentMessages: [],
    currentUserMessage: "hoi",
    userBurstLines: ["hoi"],
  });
  for (const sample of validSamples) {
    if (!isValidGreetingOnlyBotReply(sample)) {
      errors.push(`valid sample rejected by isValidGreetingOnlyBotReply: ${sample}`);
      continue;
    }
    const q = validateChatQuality({
      currentUserMessage: "hoi",
      recentMessages: [],
      candidateBotResponse: sample,
      normalizedIntent: intent,
    });
    if (!q.isValid) {
      errors.push(`valid sample failed quality gate: ${sample} (${q.reasons.join(",")})`);
    }
  }

  const invalid = "lekker relaxed aan het";
  if (isValidGreetingOnlyBotReply(invalid)) {
    errors.push("invalid fragment incorrectly accepted");
  }

  // Same persona 5 chats should vary
  const samePeer: string[] = [];
  for (let i = 0; i < 5; i++) {
    samePeer.push(
      pickNonRepeatingPersonaGreeting({
        peerId: "same-peer",
        conversationId: `conv-${i}`,
        personaName: "Test",
        vibeTags: ["playful"],
        flirtLevel: "medium",
        userMessage: "hoi",
        recentBotMessages: samePeer.slice(-3),
        seedSalt: `open-${i}`,
      }),
    );
  }
  if (new Set(samePeer).size < 2) {
    errors.push(`same persona 5 opens: only ${new Set(samePeer).size} unique`);
  }

  return { passed: errors.length === 0, errors, greetings };
}
