import type { ChatMessageRow } from "@/lib/chat/map-rows";
import type { GrokInputMessage } from "@/lib/xai/grok-responses";
import { grokResponsesComplete } from "@/lib/xai/grok-responses";

/**
 * Verbatim dialogue tail sent to Grok. Older lines are folded into
 * `threadSummary` (safer than sending the full thread — cost + context limits).
 */
const RECENT_MESSAGE_COUNT = 50;

export type ThreadMemoryRow = {
  summary: string;
  prefix_messages_count: number;
};

function formatChunkForSummary(rows: ChatMessageRow[]): string {
  return rows
    .map((m) => {
      const who = m.sender === "me" ? "Them" : "You";
      const body =
        m.kind === "image" ? "[photo]" : (m.body ?? "").trim() || "…";
      return `${who}: ${body}`;
    })
    .join("\n");
}

/**
 * When there are more than RECENT_MESSAGE_COUNT messages, older lines must be
 * folded into `summary` so the model still has continuity.
 */
export async function refreshThreadSummaryIfNeeded(
  history: ChatMessageRow[],
  prev: ThreadMemoryRow | null,
  options?: { temperature?: number },
): Promise<ThreadMemoryRow> {
  const len = history.length;
  if (len <= RECENT_MESSAGE_COUNT) {
    return { summary: "", prefix_messages_count: 0 };
  }

  const prefixEnd = len - RECENT_MESSAGE_COUNT;
  let summary = (prev?.summary ?? "").trim();
  let prefix_messages_count = prev?.prefix_messages_count ?? 0;

  if (prefix_messages_count >= prefixEnd) {
    return { summary, prefix_messages_count };
  }

  const chunk = history.slice(prefix_messages_count, prefixEnd);
  if (chunk.length === 0) {
    return { summary, prefix_messages_count };
  }

  const input: GrokInputMessage[] = [
    {
      role: "system",
      content:
        "You maintain a compact memory note for a private dating-app chat (max ~650 characters). " +
        "Third person or neutral. Capture topics, names, plans, preferences, tone — not verbatim dialogue. " +
        "Write the note in Dutch. Output ONLY the updated note, no preamble or quotes.",
    },
    {
      role: "user",
      content:
        (summary ? `Previous note:\n${summary}\n\n` : "") +
        `Fold these older messages into the note (merge, don’t list every line):\n${formatChunkForSummary(chunk)}`,
    },
  ];

  const out = await grokResponsesComplete(input, {
    temperature: options?.temperature ?? 0.35,
    maxOutputTokens: 512,
  });

  if (!out.ok) {
    return { summary, prefix_messages_count };
  }

  const nextSummary = out.text.trim().slice(0, 2000);
  return {
    summary: nextSummary,
    prefix_messages_count: prefixEnd,
  };
}

export function sliceRecentDialogue(history: ChatMessageRow[]): ChatMessageRow[] {
  if (history.length <= RECENT_MESSAGE_COUNT) return history;
  return history.slice(-RECENT_MESSAGE_COUNT);
}

export { RECENT_MESSAGE_COUNT };
