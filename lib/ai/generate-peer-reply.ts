/**
 * Shared "generate the AI peer reply now" pipeline. Both the synchronous POST
 * /messages flow and the async pending-reply delivery (POST /poll-pending,
 * lazy GET catch-up) call into this so the prompt-build / Grok-call /
 * postprocess / revise / DB-insert / log-insert sequence stays in one place.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AI_CHAT_PROMPT_VERSION,
  buildGrokSystemPrompt,
} from "@/lib/ai/build-grok-system-prompt";
import {
  RECENT_MESSAGE_COUNT,
  refreshThreadSummaryIfNeeded,
  sliceRecentDialogue,
  type ThreadMemoryRow,
} from "@/lib/ai/thread-memory";
import {
  endsWithQuestion,
  hasEmoji,
  postProcessReply,
} from "@/lib/ai/post-process-reply";
import {
  isDraftReviseEnabled,
  reviseDraftIfWorthIt,
} from "@/lib/ai/draft-revise";
import type { ChatMessageRow, ChatProfileRow } from "@/lib/chat/map-rows";
import type { GrokInputMessage } from "@/lib/xai/grok-responses";
import { grokResponsesComplete } from "@/lib/xai/grok-responses";

export type GeneratePeerReplyResult =
  | {
      ok: true;
      assistantRow: ChatMessageRow;
      finalText: string;
      revised: boolean;
      latencyMs: number;
      model: string;
      turnIndex: number;
      userSilenceMs: number | null;
    }
  | {
      ok: false;
      error: string;
      latencyMs: number;
      model: string;
    };

export type GeneratePeerReplyOptions = {
  /**
   * The user message id this reply is responding to. Used for log linkage and
   * to compute turn index / user silence consistently with the original POST.
   * If omitted, the latest user message in history is used.
   */
  triggerUserMessageId?: string;
};

/**
 * Run the full generate-and-persist pipeline. Returns success with the
 * inserted assistant row, or failure with an error message. Side-effects:
 *   - upserts chat_ai_thread_memory
 *   - inserts chat_messages (the peer row)
 *   - inserts ai_chat_turn_logs
 *
 * Caller is responsible for fetching the latest history and profile before
 * invoking — this keeps the helper pure with respect to its inputs and
 * lets POST/GET callers reuse data they already loaded.
 */
export async function generatePeerReply(
  supabase: SupabaseClient,
  args: {
    profile: ChatProfileRow;
    history: ChatMessageRow[];
    ownerUserId: string;
    peerId: string;
    options?: GeneratePeerReplyOptions;
  },
): Promise<GeneratePeerReplyResult> {
  const t0 = Date.now();
  const resolvedModel =
    process.env.XAI_CHAT_MODEL?.trim() || "grok-4.3";

  const triggerId = args.options?.triggerUserMessageId;

  // Refresh + persist thread memory (older lines folded into a structured note).
  const { data: memRow } = await supabase
    .from("chat_ai_thread_memory")
    .select("summary, prefix_messages_count")
    .eq("peer_id", args.peerId)
    .eq("owner_user_id", args.ownerUserId)
    .maybeSingle();

  const m = memRow as
    | { summary: string; prefix_messages_count: number }
    | null
    | undefined;
  const prevMemory: ThreadMemoryRow | null =
    m &&
    typeof m.summary === "string" &&
    typeof m.prefix_messages_count === "number"
      ? { summary: m.summary, prefix_messages_count: m.prefix_messages_count }
      : null;

  const memory = await refreshThreadSummaryIfNeeded(args.history, prevMemory);

  await supabase.from("chat_ai_thread_memory").upsert(
    {
      owner_user_id: args.ownerUserId,
      peer_id: args.peerId,
      summary: memory.summary,
      prefix_messages_count: memory.prefix_messages_count,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_user_id,peer_id" },
  );

  const threadSummaryForPrompt =
    args.history.length > RECENT_MESSAGE_COUNT && memory.summary.trim()
      ? memory.summary.trim()
      : undefined;

  // Turn-context: how many AI replies already happened, and how long the user
  // was silent between their previous and most-recent message. Both feed the
  // prompt so it can pace tone and call out long silences naturally.
  let priorAssistantTurns = 0;
  let priorUserAt: number | null = null;
  let triggerUserAt: number | null = null;
  for (const row of args.history) {
    if (row.sender === "peer") {
      priorAssistantTurns += 1;
    }
    if (row.sender === "me") {
      const ts = new Date(row.created_at).getTime();
      if (Number.isFinite(ts)) {
        if (triggerId && row.id === triggerId) {
          triggerUserAt = ts;
        } else if (!triggerId || ts < (triggerUserAt ?? Number.POSITIVE_INFINITY)) {
          // priorUserAt = "the user msg before the trigger one"
          priorUserAt = priorUserAt === null ? ts : Math.max(priorUserAt, ts);
        }
      }
    }
  }
  // If no triggerId given, pick the last user msg in history as the trigger.
  if (triggerUserAt === null) {
    for (let i = args.history.length - 1; i >= 0; i--) {
      if (args.history[i].sender === "me") {
        const ts = new Date(args.history[i].created_at).getTime();
        if (Number.isFinite(ts)) {
          triggerUserAt = ts;
          break;
        }
      }
    }
  }
  const userSilenceMs =
    triggerUserAt !== null && priorUserAt !== null && triggerUserAt > priorUserAt
      ? triggerUserAt - priorUserAt
      : null;

  const system = buildGrokSystemPrompt(args.profile, {
    threadSummary: threadSummaryForPrompt,
    nowLocal: new Date(),
    turnIndex: priorAssistantTurns,
    userSilenceMs: userSilenceMs ?? undefined,
  });

  const tail = sliceRecentDialogue(args.history);
  const input: GrokInputMessage[] = [
    { role: "system", content: system },
    ...tail.map((r) => ({
      role: (r.sender === "me" ? "user" : "assistant") as "user" | "assistant",
      content:
        r.kind === "image"
          ? "[They sent a photo]"
          : (r.body ?? "").trim() || "…",
    })),
  ];

  let grok: Awaited<ReturnType<typeof grokResponsesComplete>>;
  try {
    grok = await grokResponsesComplete(input);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    grok = { ok: false as const, error: msg };
  }

  if (!grok.ok) {
    const latencyMs = Date.now() - t0;
    await supabase.from("ai_chat_turn_logs").insert({
      owner_user_id: args.ownerUserId,
      peer_id: args.peerId,
      user_message_id: triggerId ?? null,
      assistant_message_id: null,
      model: resolvedModel,
      ok: false,
      error: grok.error,
      latency_ms: latencyMs,
      prompt_version: AI_CHAT_PROMPT_VERSION,
      turn_index: priorAssistantTurns,
      user_silence_ms: userSilenceMs,
    });
    return { ok: false, error: grok.error, latencyMs, model: resolvedModel };
  }

  // Optional second-pass refinement.
  let draftText = grok.text;
  let revised = false;
  if (isDraftReviseEnabled()) {
    try {
      const r = await reviseDraftIfWorthIt(draftText, system);
      draftText = r.text;
      revised = r.revised;
    } catch {
      /* keep draft */
    }
  }

  const finalText = postProcessReply(draftText);
  if (!finalText) {
    const latencyMs = Date.now() - t0;
    await supabase.from("ai_chat_turn_logs").insert({
      owner_user_id: args.ownerUserId,
      peer_id: args.peerId,
      user_message_id: triggerId ?? null,
      assistant_message_id: null,
      model: grok.model,
      ok: false,
      error: "Lege reactie na postprocessing",
      latency_ms: latencyMs,
      prompt_version: AI_CHAT_PROMPT_VERSION,
      turn_index: priorAssistantTurns,
      user_silence_ms: userSilenceMs,
    });
    return {
      ok: false,
      error: "Lege reactie na postprocessing",
      latencyMs,
      model: grok.model,
    };
  }

  const { data: insertedPeer, error: peIns } = await supabase
    .from("chat_messages")
    .insert({
      peer_id: args.peerId,
      sender: "peer",
      kind: "text",
      body: finalText,
      owner_user_id: args.ownerUserId,
    })
    .select("*")
    .single();

  const latencyMs = Date.now() - t0;
  if (peIns || !insertedPeer) {
    await supabase.from("ai_chat_turn_logs").insert({
      owner_user_id: args.ownerUserId,
      peer_id: args.peerId,
      user_message_id: triggerId ?? null,
      assistant_message_id: null,
      model: grok.model,
      ok: false,
      error: peIns?.message ?? "Insert mislukt",
      latency_ms: latencyMs,
      prompt_version: AI_CHAT_PROMPT_VERSION,
      turn_index: priorAssistantTurns,
      user_silence_ms: userSilenceMs,
    });
    return {
      ok: false,
      error: peIns?.message ?? "Insert mislukt",
      latencyMs,
      model: grok.model,
    };
  }

  const assistantRow = insertedPeer as ChatMessageRow;
  await supabase.from("ai_chat_turn_logs").insert({
    owner_user_id: args.ownerUserId,
    peer_id: args.peerId,
    user_message_id: triggerId ?? null,
    assistant_message_id: assistantRow.id,
    model: grok.model,
    ok: true,
    error: null,
    latency_ms: latencyMs,
    prompt_version: AI_CHAT_PROMPT_VERSION,
    turn_index: priorAssistantTurns,
    user_silence_ms: userSilenceMs,
    output_chars: finalText.length,
    had_question_mark: endsWithQuestion(finalText),
    had_emoji: hasEmoji(finalText),
    revised,
  });

  return {
    ok: true,
    assistantRow,
    finalText,
    revised,
    latencyMs,
    model: grok.model,
    turnIndex: priorAssistantTurns,
    userSilenceMs,
  };
}
