/**
 * Grouped per-turn debug log (development only).
 */

import type { ChatTurnPlan } from "@/lib/ai/chat-turn-plan";

export type ChatTurnDebugState = {
  peerId: string;
  promptVersion: string;
  userMessagesSinceLastPeerReply: string[];
  chatTurnPlan: ChatTurnPlan | null;
  rawGrokResponse: string;
  afterDraftRevise: string;
  afterCoherence: string;
  afterLightCleanup: string;
  finalCandidate: string;
  finalCoherenceValid: boolean;
  invalidReasons: string[];
  correctedResponse: string;
  finalResponse: string;
};

export function createChatTurnDebug(peerId: string, promptVersion: string): ChatTurnDebugState {
  return {
    peerId,
    promptVersion,
    userMessagesSinceLastPeerReply: [],
    chatTurnPlan: null,
    rawGrokResponse: "",
    afterDraftRevise: "",
    afterCoherence: "",
    afterLightCleanup: "",
    finalCandidate: "",
    finalCoherenceValid: true,
    invalidReasons: [],
    correctedResponse: "",
    finalResponse: "",
  };
}

export function logChatTurnDebug(state: ChatTurnDebugState): void {
  if (process.env.NODE_ENV !== "development") return;
  console.info("[chat-turn-debug]", JSON.stringify(state, null, 2));
}
