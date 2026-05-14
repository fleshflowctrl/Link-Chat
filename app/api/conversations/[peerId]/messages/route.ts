import { NextResponse } from "next/server";
import type { ChatMessage } from "@/data/messages";
import {
  messageRowToUi,
  type ChatMessageRow,
  type ChatProfileRow,
} from "@/lib/chat/map-rows";
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
import { computeReplyDelayMs, sleep } from "@/lib/ai/reply-pacing";
import type { GrokInputMessage } from "@/lib/xai/grok-responses";
import { grokResponsesComplete } from "@/lib/xai/grok-responses";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
/** Grok reasoning can exceed default limits; raise on hosts that support it (e.g. Vercel). */
export const maxDuration = 120;

const MAX_LEN = 4000;

export async function GET(
  _request: Request,
  { params }: { params: { peerId: string } },
) {
  const peerId = params.peerId;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Niet geautoriseerd" }, { status: 401 });
  }

  const { data: msgs, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("peer_id", peerId)
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    messages: ((msgs ?? []) as ChatMessageRow[]).map(messageRowToUi),
  });
}

export async function POST(
  request: Request,
  { params }: { params: { peerId: string } },
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige JSON" }, { status: 400 });
  }

  const obj = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const text = typeof obj.text === "string" ? obj.text.trim() : "";
  const imageUrl = typeof obj.imageUrl === "string" ? obj.imageUrl.trim() : "";
  const isImage = imageUrl.length > 0;

  if (!isImage && !text) {
    return NextResponse.json(
      { ok: false, error: "Geen tekst of afbeelding" },
      { status: 400 },
    );
  }
  if (text.length > MAX_LEN) {
    return NextResponse.json(
      { ok: false, error: `Bericht te lang (max. ${MAX_LEN} tekens)` },
      { status: 400 },
    );
  }
  if (isImage && !/^https?:\/\//.test(imageUrl)) {
    return NextResponse.json(
      { ok: false, error: "Ongeldige afbeeldings-URL" },
      { status: 400 },
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Niet geautoriseerd" }, { status: 401 });
  }

  const peerId = params.peerId;

  const { data: profile, error: pe } = await supabase
    .from("chat_profiles")
    .select("*")
    .eq("id", peerId)
    .maybeSingle();

  if (pe || !profile) {
    return NextResponse.json({ ok: false, error: "Onbekende persoon" }, { status: 404 });
  }

  const p = profile as ChatProfileRow;

  const { data: insertedUser, error: ie } = await supabase
    .from("chat_messages")
    .insert({
      peer_id: peerId,
      sender: "me",
      kind: isImage ? "image" : "text",
      body: isImage ? null : text,
      image_url: isImage ? imageUrl : null,
      owner_user_id: user.id,
    })
    .select("*")
    .single();

  if (ie || !insertedUser) {
    return NextResponse.json(
      { ok: false, error: ie?.message ?? "Opslaan mislukt" },
      { status: 500 },
    );
  }

  const userMessage = messageRowToUi(insertedUser as ChatMessageRow);

  const { data: historyRows, error: he } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("peer_id", peerId)
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: true });

  if (he) {
    return NextResponse.json(
      { ok: true, userMessage, peerMessage: null, warning: he.message },
      { status: 200 },
    );
  }

  const history = (historyRows ?? []) as ChatMessageRow[];

  let peerMessage: ChatMessage | null = null;
  let warning: string | undefined;

  if (p.is_ai) {
    const t0 = Date.now();
    let resolvedModel: string | null =
      process.env.XAI_CHAT_MODEL?.trim() || "grok-4.3";

    const { data: memRow, error: memErr } = await supabase
      .from("chat_ai_thread_memory")
      .select("summary, prefix_messages_count")
      .eq("peer_id", peerId)
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (memErr) {
      console.warn("[conversations/messages] thread memory select", peerId, memErr.message);
    }

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

    const memory = await refreshThreadSummaryIfNeeded(history, prevMemory);

    const { error: memUpsertErr } = await supabase.from("chat_ai_thread_memory").upsert(
      {
        owner_user_id: user.id,
        peer_id: peerId,
        summary: memory.summary,
        prefix_messages_count: memory.prefix_messages_count,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "owner_user_id,peer_id" },
    );

    if (memUpsertErr) {
      console.warn("[conversations/messages] thread memory upsert", peerId, memUpsertErr.message);
    }

    const threadSummaryForPrompt =
      history.length > RECENT_MESSAGE_COUNT && memory.summary.trim()
        ? memory.summary.trim()
        : undefined;

    // Turn-context: how many AI replies we've already sent (= prior `peer` messages,
    // excluding the just-inserted `me` message), and how long the user was silent
    // between their previous message and this one. Both are used by the system
    // prompt to set tone, pacing stage, and natural acknowledgement of silence.
    let priorAssistantTurns = 0;
    let priorUserAt: number | null = null;
    for (const row of history) {
      if (row.id === insertedUser.id) continue;
      if (row.sender === "peer") priorAssistantTurns += 1;
      if (row.sender === "me") {
        const t = new Date(row.created_at).getTime();
        if (Number.isFinite(t)) priorUserAt = t;
      }
    }
    const insertedAt = new Date(insertedUser.created_at).getTime();
    const userSilenceMs =
      priorUserAt !== null && Number.isFinite(insertedAt) && insertedAt > priorUserAt
        ? insertedAt - priorUserAt
        : undefined;

    const system = buildGrokSystemPrompt(p, {
      threadSummary: threadSummaryForPrompt,
      nowLocal: new Date(),
      turnIndex: priorAssistantTurns,
      userSilenceMs,
    });

    const tail = sliceRecentDialogue(history);
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
      console.error("[conversations/messages] grok threw", peerId, msg);
      grok = { ok: false as const, error: msg };
    }

    if (grok.ok) {
      resolvedModel = grok.model;
    }

    if (!grok.ok) {
      console.error("[conversations/messages] grok failed", peerId, grok.error);
    }

    let assistantRow: ChatMessageRow | null = null;
    let revised = false;
    let finalText = "";

    if (grok.ok) {
      // Optional second pass: ask the editor whether the draft sounds AI;
      // rewrite once if so. Off by default (XAI_DRAFT_REVISE).
      let draftText = grok.text;
      if (isDraftReviseEnabled()) {
        try {
          const r = await reviseDraftIfWorthIt(draftText, system);
          draftText = r.text;
          revised = r.revised;
        } catch (e) {
          console.warn(
            "[conversations/messages] revise pass threw",
            peerId,
            e instanceof Error ? e.message : String(e),
          );
        }
      }

      // Defensive scrub of any markdown / service-y leakage / em-dashes /
      // runaway length before persisting.
      finalText = postProcessReply(draftText);

      if (!finalText) {
        warning = "Lege reactie na postprocessing";
      } else {
        // Human-like pacing: hold the response for a calculated delay so the
        // client shows a typing indicator for a believable amount of time. We
        // subtract the time we already spent in Grok + revise so a slow Grok
        // call effectively counts as part of the human delay (and a fast one
        // gets padded out). Capped inside the helper.
        const elapsed = Date.now() - t0;
        const target = computeReplyDelayMs({
          turnIndex: priorAssistantTurns,
          userMessageChars: (text || "").length,
          replyChars: finalText.length,
        });
        const remainingDelay = Math.max(0, target - elapsed);
        if (remainingDelay > 0) {
          await sleep(remainingDelay);
        }

        const { data: insertedPeer, error: peIns } = await supabase
          .from("chat_messages")
          .insert({
            peer_id: peerId,
            sender: "peer",
            kind: "text",
            body: finalText,
            owner_user_id: user.id,
          })
          .select("*")
          .single();

        if (!peIns && insertedPeer) {
          assistantRow = insertedPeer as ChatMessageRow;
          peerMessage = messageRowToUi(assistantRow);
        } else if (peIns) {
          warning = peIns.message;
        }
      }
    } else {
      warning = grok.error;
    }

    const latencyMs = Date.now() - t0;
    const { error: logErr } = await supabase.from("ai_chat_turn_logs").insert({
      owner_user_id: user.id,
      peer_id: peerId,
      user_message_id: insertedUser.id,
      assistant_message_id: assistantRow?.id ?? null,
      model: resolvedModel,
      ok: grok.ok,
      error: grok.ok ? null : grok.error,
      latency_ms: latencyMs,
      prompt_version: AI_CHAT_PROMPT_VERSION,
      turn_index: priorAssistantTurns,
      user_silence_ms:
        typeof userSilenceMs === "number" ? userSilenceMs : null,
      output_chars: finalText.length || null,
      had_question_mark: finalText ? endsWithQuestion(finalText) : null,
      had_emoji: finalText ? hasEmoji(finalText) : null,
      revised,
    });

    if (logErr) {
      console.warn("[conversations/messages] ai turn log insert", peerId, logErr.message);
    }
  }

  return NextResponse.json({
    ok: true,
    userMessage,
    peerMessage,
    ...(warning ? { warning } : {}),
  });
}
