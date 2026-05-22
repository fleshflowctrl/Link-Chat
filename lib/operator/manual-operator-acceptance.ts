/**
 * Acceptance checks for MANUAL_OPERATOR_MODE (run with env set in shell).
 */

import { isManualOperatorMode } from "@/lib/manual-operator-mode";

export type ManualOperatorAcceptanceResult = {
  id: string;
  passed: boolean;
  detail?: string;
};

/** Pure logic tests — no DB. */
export function runManualOperatorLogicAcceptance(): ManualOperatorAcceptanceResult[] {
  const results: ManualOperatorAcceptanceResult[] = [];
  const prev = process.env.MANUAL_OPERATOR_MODE;
  process.env.MANUAL_OPERATOR_MODE = "1";

  results.push({
    id: "flag-detect",
    passed: isManualOperatorMode(),
    detail: isManualOperatorMode() ? "ok" : "MANUAL_OPERATOR_MODE not detected",
  });

  if (prev === undefined) delete process.env.MANUAL_OPERATOR_MODE;
  else process.env.MANUAL_OPERATOR_MODE = prev;

  return results;
}

/** Document expected integration behaviour (CI without DB). */
export const MANUAL_OPERATOR_ACCEPTANCE_SPEC = [
  "User POST with MANUAL_OPERATOR_MODE=1: no generatePeerReply, queue row upserted",
  "Operator POST reply: peer message with message_source=operator_manual",
  "processDuePendingReplies returns empty when manual mode",
  "maybeScheduleSpontaneous/winback return null when manual mode",
  "queueCoalescedPeerReply returns ok:false when manual mode",
  "suggest-reply returns suggestion without chat_messages insert",
] as const;
