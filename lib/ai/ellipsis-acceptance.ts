/**
 * Acceptance fixtures for ellipsis realism guard.
 */

import { applyEllipsisRealismGuard } from "@/lib/ai/ellipsis-realism-guard";
import { buildChatTurnPlan } from "@/lib/ai/chat-turn-plan";
import type { RecentTurn } from "@/lib/ai/conversation-state-guard";

export type EllipsisAcceptanceCase = {
  id: string;
  userBurstLines: string[];
  badChunks: string[];
  expectNotContaining?: string[];
  recentBotMessages?: string[];
};

export const ELLIPSIS_ACCEPTANCE_CASES: EllipsisAcceptanceCase[] = [
  {
    id: "ellipsis-greeting",
    userBurstLines: ["hoi"],
    badChunks: ["hoi..."],
    expectNotContaining: ["..."],
  },
  {
    id: "ellipsis-how-are-you",
    userBurstLines: ["hoe gaat het?"],
    badChunks: ["goed zo... en jij..."],
    expectNotContaining: ["..."],
  },
  {
    id: "ellipsis-goed-bij-jou",
    userBurstLines: ["goed bij jou?"],
    badChunks: ["goed hoor, en met jou..."],
    expectNotContaining: ["..."],
  },
  {
    id: "ellipsis-wat-doe-je",
    userBurstLines: ["wat doe je?"],
    badChunks: ["niet veel..."],
    expectNotContaining: ["..."],
  },
];

export async function runEllipsisAcceptanceChecks(): Promise<
  { id: string; passed: boolean; errors: string[]; finalText: string }[]
> {
  const results: { id: string; passed: boolean; errors: string[]; finalText: string }[] = [];

  for (const c of ELLIPSIS_ACCEPTANCE_CASES) {
    const errors: string[] = [];
    const recentMessages: RecentTurn[] = [];
    const plan = buildChatTurnPlan({
      recentMessages,
      currentUserMessage: c.userBurstLines.join("\n"),
      userBurstLines: c.userBurstLines,
    });

    const guard = applyEllipsisRealismGuard({
      chunks: c.badChunks,
      recentBotMessages: c.recentBotMessages ?? [],
      currentUserMessage: c.userBurstLines.join("\n"),
      combinedUserIntent: plan.normalizedIntent.combinedUserIntent,
      chatTurnPlan: plan,
    });

    const finalText = guard.finalResponse;
    for (const phrase of c.expectNotContaining ?? []) {
      if (finalText.includes(phrase)) errors.push(`still contains: ${phrase}`);
    }

    results.push({ id: c.id, passed: errors.length === 0, errors, finalText });
  }

  return results;
}
