export function logManualOperatorMode(meta: {
  conversationId: string;
  peerId: string;
  ownerUserId: string;
  userMessageInserted: boolean;
  aiReplyGenerated: boolean;
  queuedForOperator: boolean;
}): void {
  if (process.env.NODE_ENV === "production" && !isManualOperatorModeEnv()) return;
  console.info("[manual-operator-mode]", JSON.stringify(meta, null, 2));
}

export function logOperatorReply(meta: {
  conversationId: string;
  peerId: string;
  ownerUserId: string;
  operatorId: string;
  messageInserted: boolean;
}): void {
  console.info("[operator-reply]", JSON.stringify(meta, null, 2));
}

export function logAiSuggestion(meta: {
  conversationId: string;
  peerId: string;
  ownerUserId: string;
  suggestionGenerated: boolean;
  sentAutomatically: boolean;
}): void {
  console.info("[ai-suggestion]", JSON.stringify(meta, null, 2));
}

function isManualOperatorModeEnv(): boolean {
  const raw = process.env.MANUAL_OPERATOR_MODE?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}
