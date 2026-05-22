/**
 * Cosmetic-only cleanup on full response text — no new questions, facts, or intent changes.
 */

import type { ChatTurnPlan } from "@/lib/ai/chat-turn-plan";
import { cleanupLanguageChunk } from "@/lib/ai/language-cleanup";
import { MULTI_MESSAGE_SEPARATOR } from "@/lib/ai/post-process-reply";

/** Strip markdown-ish noise without changing meaning. */
function cosmeticLine(s: string): string {
  let t = s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/\s*\u2014\s*/g, " - ")
    .trim();
  return cleanupLanguageChunk(t);
}

/**
 * Light pass on full unsplit or split-ready text. Preserves <<<>>> separators.
 */
export function applyLightTextCleanup(text: string, _plan?: ChatTurnPlan): string {
  if (!text.includes(MULTI_MESSAGE_SEPARATOR)) {
    return cosmeticLine(text);
  }
  return text
    .split(/\n*\s*<<<>>>\s*\n*/)
    .map((p) => cosmeticLine(p.trim()))
    .filter(Boolean)
    .join(`\n${MULTI_MESSAGE_SEPARATOR}\n`);
}
