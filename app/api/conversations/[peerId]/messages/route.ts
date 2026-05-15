import { NextResponse } from "next/server";
import type { ChatMessage } from "@/data/messages";
import {
  messageRowToUi,
  type ChatMessageRow,
  type ChatProfileRow,
} from "@/lib/chat/map-rows";
import { generatePeerReply } from "@/lib/ai/generate-peer-reply";
import { processDuePendingReplies } from "@/lib/ai/pending-replies";
import {
  maybeScheduleSpontaneous,
  maybeScheduleWinback,
} from "@/lib/ai/spontaneous";
import {
  computeReplyPacing,
  sleep,
  SYNC_DELAY_THRESHOLD_MS,
} from "@/lib/ai/reply-pacing";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
/** Grok reasoning + sync pacing can exceed default limits. */
export const maxDuration = 120;

const MAX_LEN = 4000;

/** Look at history (oldest→newest) and return the most recent peer-side
 * reply timestamp, or null if she's never replied yet. Used by the pacing
 * function to choose engagement mode (hot/warm/cold). */
function lastPeerReplyAt(history: ChatMessageRow[]): Date | null {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].sender === "peer") {
      const t = new Date(history[i].created_at);
      if (!Number.isNaN(t.getTime())) return t;
      return null;
    }
  }
  return null;
}

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

  // Lazy catch-up: if a pending reply is due (e.g. user closed the app and is
  // now reopening), deliver it before returning so it shows up in this load.
  const { data: profileForGet } = await supabase
    .from("chat_profiles")
    .select("*")
    .eq("id", peerId)
    .maybeSingle();

  let nextPendingAt: string | null = null;
  if (profileForGet && (profileForGet as ChatProfileRow).is_ai) {
    try {
      const r = await processDuePendingReplies(supabase, {
        ownerUserId: user.id,
        peerId,
        profile: profileForGet as ChatProfileRow,
      });
      nextPendingAt = r.nextPendingAt;
    } catch (e) {
      console.warn(
        "[conversations/messages GET] processDuePending threw",
        peerId,
        e instanceof Error ? e.message : String(e),
      );
    }

    // Lazy winback check: when the user opens the thread (or the home
    // screen polls), if she's been silent for >22h and we don't have a
    // winback queued yet, maybe schedule one. This piggybacks on existing
    // traffic so we don't need a cron job.
    try {
      const { data: histForWinback } = await supabase
        .from("chat_messages")
        .select("id, sender, created_at")
        .eq("peer_id", peerId)
        .eq("owner_user_id", user.id)
        .order("created_at", { ascending: true });
      if (histForWinback) {
        await maybeScheduleWinback(supabase, {
          ownerUserId: user.id,
          peerId,
          history: histForWinback as unknown as ChatMessageRow[],
        });
      }
    } catch (e) {
      console.warn(
        "[conversations/messages GET] maybeScheduleWinback threw",
        peerId,
        e instanceof Error ? e.message : String(e),
      );
    }
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
    nextPendingAt,
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

  // 1. Persist the user message before doing anything else.
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

  // Non-AI peer: nothing more to do.
  if (!p.is_ai) {
    return NextResponse.json({
      ok: true,
      userMessage,
      peerMessage: null,
      newPeerMessages: [] as ChatMessage[],
      nextPendingAt: null,
    });
  }

  // 2. Catch up any *already-due* pending replies (older messages whose
  //    scheduled_at has passed while the user was away). These deliveries
  //    happen BEFORE we look at the new message — so the persona's reply
  //    history is up-to-date when we compute the engagement state below.
  let processedPeerMessages: ChatMessage[] = [];
  let warning: string | undefined;
  try {
    const r = await processDuePendingReplies(supabase, {
      ownerUserId: user.id,
      peerId,
      profile: p,
    });
    processedPeerMessages = r.newPeerMessages.map(messageRowToUi);
  } catch (e) {
    console.warn(
      "[conversations/messages POST] catch-up processDuePending threw",
      peerId,
      e instanceof Error ? e.message : String(e),
    );
  }

  // 3. Fetch the latest history (now possibly including freshly-delivered
  //    peer messages from step 2) so the pacing function sees the correct
  //    peerLastReplyAt and turnIndex.
  const { data: historyRows, error: he } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("peer_id", peerId)
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: true });

  if (he) {
    return NextResponse.json({
      ok: true,
      userMessage,
      peerMessage: null,
      newPeerMessages: processedPeerMessages,
      nextPendingAt: null,
      warning: he.message,
    });
  }

  const history = (historyRows ?? []) as ChatMessageRow[];
  const priorAssistantTurns = history.reduce(
    (acc, row) => acc + (row.sender === "peer" ? 1 : 0),
    0,
  );

  // 4. Decide sync vs async. We compute an *initial* delay using just the
  //    user-message length (we don't know the reply length yet without
  //    calling Grok). For sync flow we'll re-compute with replyChars after
  //    Grok returns; for async flow the typing-bonus is negligible relative
  //    to the multi-minute pause, so the initial estimate is good enough.
  const personaOccupation =
    (p as ChatProfileRow & { occupation?: string | null }).occupation ?? null;
  const initialPacing = computeReplyPacing({
    personaId: peerId,
    turnIndex: priorAssistantTurns,
    userMessageChars: (text || "").length,
    replyChars: 0,
    nowLocal: new Date(),
    peerLastReplyAt: lastPeerReplyAt(history),
    occupation: personaOccupation,
  });
  const initialDelayMs = initialPacing.delayMs;

  let peerMessage: ChatMessage | null = null;
  let nextPendingAt: string | null = null;

  if (initialDelayMs <= SYNC_DELAY_THRESHOLD_MS) {
    // Sync flow: generate now, hold the response open with sleep so the
    // client's typing indicator runs for the right amount of time.
    const t0 = Date.now();
    const result = await generatePeerReply(supabase, {
      profile: p,
      history,
      ownerUserId: user.id,
      peerId,
      options: { triggerUserMessageId: insertedUser.id },
    });

    if (!result.ok) {
      warning = result.error;
    } else {
      // Re-compute target now that we know reply length, so a long reply gets
      // its typing-time bonus. Subtract elapsed Grok time so a slow Grok
      // counts as part of the natural delay.
      const finalPacing = computeReplyPacing({
        personaId: peerId,
        turnIndex: priorAssistantTurns,
        userMessageChars: (text || "").length,
        replyChars: result.finalText.length,
        nowLocal: new Date(),
        peerLastReplyAt: lastPeerReplyAt(history),
        occupation: personaOccupation,
      });
      const elapsed = Date.now() - t0;
      const remaining = Math.max(0, finalPacing.delayMs - elapsed);
      if (remaining > 0 && remaining <= SYNC_DELAY_THRESHOLD_MS) {
        await sleep(remaining);
      }
      peerMessage = messageRowToUi(result.assistantRow);
      // If Grok produced a multi-bubble reply, the additional chunks are
      // already queued via chat_pending_replies (kind='chunk'). Surface
      // their earliest scheduled_at so the client arms a poll timer.
      if (result.additionalChunks > 0 && result.nextChunkAt) {
        nextPendingAt = result.nextChunkAt;
      }
    }
  } else {
    // Async flow: queue a pending row, return immediately, let the client
    // poll at scheduled_at. The persona will appear "away" until the timer
    // fires (or until a later GET catches it up if the user closes the app).
    const scheduledAt = new Date(Date.now() + initialDelayMs).toISOString();
    const { error: queueErr } = await supabase
      .from("chat_pending_replies")
      .insert({
        user_message_id: insertedUser.id,
        owner_user_id: user.id,
        peer_id: peerId,
        scheduled_at: scheduledAt,
        status: "pending",
        kind: "reply",
      });
    if (queueErr) {
      // Fall back to sync delivery so the chat doesn't silently die. This is
      // rare (would mean RLS / FK violation).
      console.warn(
        "[conversations/messages POST] pending insert failed, falling back to sync",
        peerId,
        queueErr.message,
      );
      const result = await generatePeerReply(supabase, {
        profile: p,
        history,
        ownerUserId: user.id,
        peerId,
        options: { triggerUserMessageId: insertedUser.id },
      });
      if (result.ok) {
        peerMessage = messageRowToUi(result.assistantRow);
        if (result.additionalChunks > 0 && result.nextChunkAt) {
          nextPendingAt = result.nextChunkAt;
        }
      } else {
        warning = result.error;
      }
    } else {
      nextPendingAt = scheduledAt;
    }
  }

  // 5. After delivering (or queuing) the reply, maybe schedule a spontaneous
  //    follow-up. This is fire-and-forget — failures are logged, not raised.
  try {
    await maybeScheduleSpontaneous(supabase, {
      ownerUserId: user.id,
      peerId,
      triggerUserMessageId: insertedUser.id,
      history,
    });
  } catch (e) {
    console.warn(
      "[conversations/messages POST] maybeScheduleSpontaneous threw",
      peerId,
      e instanceof Error ? e.message : String(e),
    );
  }

  return NextResponse.json({
    ok: true,
    userMessage,
    peerMessage,
    newPeerMessages: processedPeerMessages,
    nextPendingAt,
    ...(warning ? { warning } : {}),
  });
}
