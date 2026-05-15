/**
 * Shared "generate the AI peer reply now" pipeline. Both the synchronous POST
 * /messages flow and the async pending-reply delivery (POST /poll-pending,
 * lazy GET catch-up) call into this so the prompt-build / Grok-call /
 * postprocess / revise / DB-insert / log-insert sequence stays in one place.
 *
 * Realism v7 adds:
 *   - relationship-stage drift (daysActive)
 *   - structured memory (facts / loops / inside jokes)
 *   - anti-loop banned-phrases list from recent peer replies
 *   - multi-message split (chunks[1..] queued via chat_pending_replies)
 *   - read receipts (set peer_read_at on user messages this reply addresses)
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
  refreshStructuredMemoryIfNeeded,
  hasAnyFacts,
  type StructuredMemoryRow,
  type StructuredFacts,
} from "@/lib/ai/structured-memory";
import {
  endsWithQuestion,
  hasEmoji,
  postProcessReply,
  splitMultiMessage,
} from "@/lib/ai/post-process-reply";
import {
  isDraftReviseEnabled,
  reviseDraftIfWorthIt,
} from "@/lib/ai/draft-revise";
import { getBedtimeContext } from "@/lib/ai/bedtime";
import { extractPhotoDirective } from "@/lib/ai/photo-directive";
import { generatePersonaPhoto } from "@/lib/images/generate-photo";
import { buildPersonaPhotoPrompt } from "@/lib/images/persona-photo-prompt";
import { uploadPersonaPhoto } from "@/lib/images/upload-photo";
import type { ChatMessageRow, ChatProfileRow } from "@/lib/chat/map-rows";
import type { GrokInputMessage } from "@/lib/xai/grok-responses";
import { grokResponsesComplete } from "@/lib/xai/grok-responses";

function personaTimeZone(_profile: ChatProfileRow): string {
  const env = process.env.PERSONA_DEFAULT_TZ?.trim();
  if (env) return env;
  return "Europe/Amsterdam";
}

/** Days since the very first user message in this thread. Drives the
 * relationship-stage drift in the prompt. */
function computeDaysActive(history: ChatMessageRow[]): number {
  let firstUserAt: number | null = null;
  for (const row of history) {
    if (row.sender === "me") {
      const t = new Date(row.created_at).getTime();
      if (Number.isFinite(t)) {
        firstUserAt = t;
        break;
      }
    }
  }
  if (firstUserAt === null) return 0;
  const ms = Date.now() - firstUserAt;
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/** Pull short n-gram phrases (3-6 words) from the most recent peer replies
 * that have appeared more than once. These are catchphrases the persona
 * has fallen into and we want her to vary away from. Conservative: only
 * banned if appears 2+ times within the last 8 peer messages. */
function extractBannedPhrases(history: ChatMessageRow[], lookback = 8): string[] {
  const peerBodies: string[] = [];
  for (let i = history.length - 1; i >= 0 && peerBodies.length < lookback; i--) {
    const row = history[i];
    if (row.sender !== "peer" || row.kind !== "text") continue;
    const body = (row.body ?? "").trim();
    if (body) peerBodies.push(body.toLowerCase());
  }
  if (peerBodies.length < 2) return [];

  const counts = new Map<string, number>();
  for (const body of peerBodies) {
    const tokens = body
      .replace(/[.,!?;:()"\u2018\u2019\u201C\u201D]/g, " ")
      .split(/\s+/)
      .filter(Boolean);
    // 3- and 4-word n-grams
    for (let n = 3; n <= 4; n++) {
      for (let i = 0; i + n <= tokens.length; i++) {
        const gram = tokens.slice(i, i + n).join(" ");
        if (gram.length < 8 || gram.length > 40) continue;
        counts.set(gram, (counts.get(gram) ?? 0) + 1);
      }
    }
    // Also single short tokens that are common AI tells when overused
    for (const tok of tokens) {
      if (tok.length >= 3 && tok.length <= 14) {
        counts.set(tok, (counts.get(tok) ?? 0) + 1);
      }
    }
  }

  // Filter to phrases that appeared 2+ times AND are notably "tic-y" (not
  // generic stop-words).
  const STOP = new Set([
    "ja", "nee", "een", "het", "een", "dat", "wat", "ik", "je", "we",
    "voor", "naar", "ben", "is", "ook", "als", "van", "met", "die",
    "maar", "deze", "ook", "nog", "hier", "daar",
  ]);
  const banned: Array<[string, number]> = [];
  counts.forEach((c, phrase) => {
    if (c < 2) return;
    if (phrase.split(/\s+/).every((w: string) => STOP.has(w))) return;
    banned.push([phrase, c]);
  });
  banned.sort((a, b) => b[1] - a[1]);
  return banned.slice(0, 8).map(([p]) => p);
}

/** Heuristic: is the user's last message emotionally weighted enough to
 * warrant a pre-ack? Cheap signals only — no model call. */
function isEmotionalUserMessage(body: string | null | undefined): boolean {
  if (!body) return false;
  const t = body.trim();
  if (t.length < 30) return false;
  const lc = t.toLowerCase();
  if (
    /[!?]{2,}|\.{3,}/.test(t) ||
    /(echt waar|serieus|niet te geloven|ben (super )?(blij|trots|geraakt)|verdrietig|kwijt|gemist|huilen|zwaar|moeilijk|stress|angst)/i.test(lc) ||
    /(ik heb|ik wou|ik wilde|net gehoord|kwam ineens|vandaag was)/i.test(lc)
  ) {
    return true;
  }
  return false;
}

/** Decide whether to allow Grok to split into multiple bubbles for this
 * turn. We suppress splitting in moments where one cohesive message reads
 * better (hook, goodnight, post-sleep wakeup). */
function decideMultiMessage(args: {
  turnIndex: number;
  bedtimePhase: "awake" | "approaching" | "asleep";
  emotional: boolean;
}): boolean {
  if (args.turnIndex < 3) return false; // hook stays a single warm reply
  if (args.bedtimePhase === "approaching") return false; // goodnight = one msg
  if (args.bedtimePhase === "asleep") return false; // morning-after = one msg
  // 70% allowed for casual turns, 30% for emotional (still useful for pre-ack)
  return Math.random() < (args.emotional ? 0.5 : 0.7);
}

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
      /** Number of additional chunk rows queued for delayed delivery. */
      additionalChunks: number;
      /** Earliest scheduled_at among the queued chunks, ISO. */
      nextChunkAt: string | null;
    }
  | {
      ok: false;
      error: string;
      latencyMs: number;
      model: string;
    };

export type GeneratePeerReplyOptions = {
  triggerUserMessageId?: string;
  /** Force-disable multi-message split (used for spontaneous + winback so
   * those stay one focused message). */
  forceSingleMessage?: boolean;
};

/**
 * Run the full generate-and-persist pipeline. Returns success with the
 * inserted assistant row (the FIRST chunk of the reply if split) plus
 * counts on any additional chunk-rows queued for delayed delivery.
 *
 * Side-effects:
 *   - upserts chat_ai_thread_memory (prose + structured)
 *   - inserts chat_messages (one or more peer rows)
 *   - inserts chat_pending_replies (kind='chunk') for additional bubbles
 *   - sets peer_read_at on user messages this reply addresses
 *   - inserts ai_chat_turn_logs
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

  // ----- Prose summary (legacy thread memory) -----
  const { data: memRow } = await supabase
    .from("chat_ai_thread_memory")
    .select("summary, prefix_messages_count, structured_facts")
    .eq("peer_id", args.peerId)
    .eq("owner_user_id", args.ownerUserId)
    .maybeSingle();

  type Row = {
    summary?: string;
    prefix_messages_count?: number;
    structured_facts?: unknown;
  };
  const m = (memRow ?? null) as Row | null;
  const prevMemory: ThreadMemoryRow | null =
    m && typeof m.summary === "string" && typeof m.prefix_messages_count === "number"
      ? { summary: m.summary, prefix_messages_count: m.prefix_messages_count }
      : null;
  const prevStructured: StructuredMemoryRow | null = (() => {
    if (!m || !m.structured_facts || typeof m.structured_facts !== "object") {
      return null;
    }
    const facts = m.structured_facts as StructuredFacts;
    // We track the structured-memory's own prefix_messages_count in the
    // structured_facts blob itself so the two memory systems can refresh
    // independently.
    const sfPrefix =
      typeof (facts as Record<string, unknown>).__prefix === "number"
        ? ((facts as Record<string, unknown>).__prefix as number)
        : 0;
    const cleanFacts: StructuredFacts = { ...facts };
    delete (cleanFacts as Record<string, unknown>).__prefix;
    return { facts: cleanFacts, prefix_messages_count: sfPrefix };
  })();

  // Refresh both in parallel — prose summary is cheap (only fires on long
  // threads), structured memory fires every ~12 new messages.
  const [memory, structured] = await Promise.all([
    refreshThreadSummaryIfNeeded(args.history, prevMemory).catch((): ThreadMemoryRow => ({
      summary: prevMemory?.summary ?? "",
      prefix_messages_count: prevMemory?.prefix_messages_count ?? 0,
    })),
    refreshStructuredMemoryIfNeeded(args.history, prevStructured).catch(
      (): StructuredMemoryRow => prevStructured ?? { facts: {}, prefix_messages_count: 0 },
    ),
  ]);

  await supabase.from("chat_ai_thread_memory").upsert(
    {
      owner_user_id: args.ownerUserId,
      peer_id: args.peerId,
      summary: memory.summary,
      prefix_messages_count: memory.prefix_messages_count,
      structured_facts: {
        ...structured.facts,
        __prefix: structured.prefix_messages_count,
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_user_id,peer_id" },
  );

  const threadSummaryForPrompt =
    args.history.length > RECENT_MESSAGE_COUNT && memory.summary.trim()
      ? memory.summary.trim()
      : undefined;

  // ----- Turn-context -----
  let priorAssistantTurns = 0;
  let priorUserAt: number | null = null;
  let triggerUserAt: number | null = null;
  for (const row of args.history) {
    if (row.sender === "peer") priorAssistantTurns += 1;
    if (row.sender === "me") {
      const ts = new Date(row.created_at).getTime();
      if (Number.isFinite(ts)) {
        if (triggerId && row.id === triggerId) {
          triggerUserAt = ts;
        } else if (!triggerId || ts < (triggerUserAt ?? Number.POSITIVE_INFINITY)) {
          priorUserAt = priorUserAt === null ? ts : Math.max(priorUserAt, ts);
        }
      }
    }
  }
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

  const peerLastReplyAtForBedtime = (() => {
    for (let i = args.history.length - 1; i >= 0; i--) {
      if (args.history[i].sender === "peer") {
        const t = new Date(args.history[i].created_at);
        if (!Number.isNaN(t.getTime())) return t;
        return null;
      }
    }
    return null;
  })();
  const bedtime = getBedtimeContext({
    now: new Date(),
    timeZone: personaTimeZone(args.profile),
    personaId: args.peerId,
    peerLastReplyAt: peerLastReplyAtForBedtime,
  });

  // ----- New realism inputs -----
  const daysActive = computeDaysActive(args.history);
  const bannedPhrases = extractBannedPhrases(args.history);

  // Find last user message body for emotional detection.
  let lastUserBody: string | null = null;
  for (let i = args.history.length - 1; i >= 0; i--) {
    if (args.history[i].sender === "me") {
      lastUserBody = args.history[i].body ?? null;
      break;
    }
  }
  const emotional = isEmotionalUserMessage(lastUserBody);
  const allowMultiMessage =
    !args.options?.forceSingleMessage &&
    decideMultiMessage({
      turnIndex: priorAssistantTurns,
      bedtimePhase: bedtime.phase,
      emotional,
    });

  // ----- Build prompt -----
  const system = buildGrokSystemPrompt(args.profile, {
    threadSummary: threadSummaryForPrompt,
    nowLocal: new Date(),
    turnIndex: priorAssistantTurns,
    userSilenceMs: userSilenceMs ?? undefined,
    bedtimePhase: bedtime.phase,
    minutesUntilBedtime: bedtime.minutesUntilBedtime,
    daysActive,
    bannedPhrases,
    structuredFacts: hasAnyFacts(structured.facts) ? structured.facts : null,
    allowMultiMessage,
    preAckMode: false, // pre-ack support reserved for a follow-up
  });

  const tail = sliceRecentDialogue(args.history);
  const input: GrokInputMessage[] = [
    { role: "system", content: system },
    ...tail.map((r) => {
      const role = (r.sender === "me" ? "user" : "assistant") as "user" | "assistant";
      // Vision: when the user sent an image, pass it as a multimodal user
      // message so Grok can see the picture and react to it. Caption (if
      // any) goes alongside as a text part.
      if (r.kind === "image" && r.sender === "me" && typeof r.image_url === "string" && /^https?:\/\//.test(r.image_url)) {
        const caption = (r.body ?? "").trim();
        const parts: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [
          {
            type: "text",
            text: caption
              ? `(zij stuurde een foto met als tekst: "${caption}")`
              : "(zij stuurde een foto, geen tekst erbij)",
          },
          { type: "image_url", image_url: { url: r.image_url } },
        ];
        return { role: "user" as const, content: parts };
      }
      return {
        role,
        content:
          r.kind === "image"
            ? "[Sent a photo]"
            : (r.body ?? "").trim() || "…",
      };
    }),
  ];

  // ----- Grok call -----
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

  // ----- Multi-message split + post-process -----
  const rawChunks = allowMultiMessage ? splitMultiMessage(draftText) : [draftText];

  // Photo directives can appear in any chunk. We extract them up front
  // so the visible chunk text stays clean, and we collect the scenes
  // along with their chunk-index so each photo arrives RIGHT AFTER the
  // text chunk it was attached to (preserves narrative flow).
  type PhotoIntent = { afterChunkIndex: number; scene: string };
  const photoIntents: PhotoIntent[] = [];
  const directiveStrippedChunks = rawChunks.map((c, idx) => {
    const ext = extractPhotoDirective(c);
    if (ext.scene) {
      photoIntents.push({ afterChunkIndex: idx, scene: ext.scene });
    }
    return ext.cleanText;
  });

  const cleanedChunks = directiveStrippedChunks
    .map((c) => postProcessReply(c))
    .filter((c) => c.length > 0);

  if (cleanedChunks.length === 0) {
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

  // ----- Insert FIRST chunk as the immediate peer message -----
  const firstText = cleanedChunks[0];
  const { data: insertedPeer, error: peIns } = await supabase
    .from("chat_messages")
    .insert({
      peer_id: args.peerId,
      sender: "peer",
      kind: "text",
      body: firstText,
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

  // ----- Mark unread user messages as read by the persona -----
  // Anything she just replied to counts as "read"; older user messages
  // without peer_read_at also flip to read (the conversation has moved on).
  const nowIso = new Date().toISOString();
  await supabase
    .from("chat_messages")
    .update({ peer_read_at: nowIso })
    .eq("peer_id", args.peerId)
    .eq("owner_user_id", args.ownerUserId)
    .eq("sender", "me")
    .is("peer_read_at", null);

  // ----- Schedule additional chunks (chunk[1..]) + photos -----
  // Both flow through the same chat_pending_replies queue with different
  // `kind` values. Times are interleaved so each photo lands right after
  // the text chunk it was attached to: text, [photo], next text, etc.
  let additionalChunks = 0;
  let nextChunkAt: string | null = null;
  type PendingInsert = {
    owner_user_id: string;
    peer_id: string;
    user_message_id: string | null;
    parent_user_message_id: string | null;
    scheduled_at: string;
    status: "pending";
    kind: "chunk" | "photo";
    payload_text: string;
  };
  const rowsToInsert: PendingInsert[] = [];

  if (cleanedChunks.length > 1 || photoIntents.length > 0) {
    let cursor = Date.now();

    // Walk the chunks in order; after each chunk (including chunk[0],
    // which is delivered immediately), interleave any photo intents that
    // were attached to that chunk, then schedule the next chunk.
    for (let i = 0; i < cleanedChunks.length; i++) {
      // Photos attached to chunk i — add a small "took the photo" delay.
      const photosForThisChunk = photoIntents.filter((p) => p.afterChunkIndex === i);
      for (const photo of photosForThisChunk) {
        // 4-12s "she just typed, now she's snapping the photo"
        const photoDelay = 4000 + Math.random() * 8000;
        cursor += photoDelay;
        rowsToInsert.push({
          owner_user_id: args.ownerUserId,
          peer_id: args.peerId,
          user_message_id: null,
          parent_user_message_id: triggerId ?? null,
          scheduled_at: new Date(cursor).toISOString(),
          status: "pending",
          kind: "photo",
          payload_text: photo.scene,
        });
      }

      // Next text chunk (skip i=0, that's already inserted as peer message).
      if (i + 1 < cleanedChunks.length) {
        const text = cleanedChunks[i + 1];
        const inter = Math.min(8000, 2000 + Math.random() * 3000 + Math.min(text.length * 50, 4000));
        cursor += inter;
        rowsToInsert.push({
          owner_user_id: args.ownerUserId,
          peer_id: args.peerId,
          user_message_id: null,
          parent_user_message_id: triggerId ?? null,
          scheduled_at: new Date(cursor).toISOString(),
          status: "pending",
          kind: "chunk",
          payload_text: text,
        });
      }
    }

    if (rowsToInsert.length > 0) {
      const { error: chIns } = await supabase
        .from("chat_pending_replies")
        .insert(rowsToInsert);
      if (!chIns) {
        additionalChunks = rowsToInsert.length;
        nextChunkAt = rowsToInsert[0].scheduled_at;
      } else {
        console.warn(
          "[generate-peer-reply] chunk/photo schedule failed",
          args.peerId,
          chIns.message,
        );
      }
    }
  }

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
    output_chars: cleanedChunks.reduce((acc, c) => acc + c.length, 0),
    had_question_mark: endsWithQuestion(firstText),
    had_emoji: hasEmoji(firstText),
    revised,
  });

  return {
    ok: true,
    assistantRow,
    finalText: firstText,
    revised,
    latencyMs,
    model: grok.model,
    turnIndex: priorAssistantTurns,
    userSilenceMs,
    additionalChunks,
    nextChunkAt,
  };
}
