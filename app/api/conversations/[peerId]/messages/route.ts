import { NextResponse } from "next/server";
import type { ChatMessage } from "@/data/messages";
import {
  messageRowToUi,
  type ChatMessageRow,
  type ChatProfileRow,
} from "@/lib/chat/map-rows";
import {
  queueCoalescedPeerReply,
  userBurstCharCount,
} from "@/lib/ai/coalesce-user-reply";
import {
  generatePeerReply,
  isPersistedPeerReply,
} from "@/lib/ai/generate-peer-reply";
import { processDuePendingReplies } from "@/lib/ai/pending-replies";
import { schedulePendingReplyDelivery } from "@/lib/ai/schedule-pending-reply-delivery";
import {
  maybeScheduleSpontaneous,
  maybeScheduleWinback,
} from "@/lib/ai/spontaneous";
import { supersedeV2OpenFollowups } from "@/lib/ai/v2-open-followup";
import {
  computeReplyPacing,
  sleep,
  syncDelayThresholdMs,
} from "@/lib/ai/reply-pacing";
import { parseAppVariant, readServerAppVariant } from "@/lib/app-variant";
import {
  applyChatProfilesVariantFilter,
  chatProfileMatchesVariant,
} from "@/lib/catalog/profile-variant";
import { isGuestAuthUser } from "@/lib/auth/user-account";
import { CHAT_MESSAGE_COST_CREDITS } from "@/lib/credits/pricing";
import { deductUserCredits, refundUserCredits } from "@/lib/credits/deduct";
import { createClient } from "@/utils/supabase/server";
import { isManualOperatorMode } from "@/lib/manual-operator-mode";
import { upsertOperatorQueueForUserMessage } from "@/lib/operator/queue";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { notifyOperatorViaTelegram } from "@/lib/telegram/notify";

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
  const requestVariant = await readServerAppVariant();

  let getProfileQuery = supabase.from("chat_profiles").select("*").eq("id", peerId);
  getProfileQuery = applyChatProfilesVariantFilter(getProfileQuery, requestVariant);
  const { data: profileForGet } = await getProfileQuery.maybeSingle();

  if (!profileForGet) {
    return NextResponse.json(
      { ok: false, error: "Onbekende persoon" },
      { status: 404 },
    );
  }

  let nextPendingAt: string | null = null;
  if ((profileForGet as ChatProfileRow).is_ai && !isManualOperatorMode()) {
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
    if (!isManualOperatorMode()) {
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
  const requestVariant = await readServerAppVariant();

  let postProfileQuery = supabase.from("chat_profiles").select("*").eq("id", peerId);
  postProfileQuery = applyChatProfilesVariantFilter(postProfileQuery, requestVariant);
  const { data: profile, error: pe } = await postProfileQuery.maybeSingle();

  if (pe || !profile || !chatProfileMatchesVariant(profile as ChatProfileRow, requestVariant)) {
    return NextResponse.json({ ok: false, error: "Onbekende persoon" }, { status: 404 });
  }

  const p = profile as ChatProfileRow;
  const peerAppVariant = parseAppVariant(p.app_variant ?? null);
  const syncThresholdMs = syncDelayThresholdMs(peerAppVariant);

  const deduct = await deductUserCredits(
    supabase,
    user.id,
    CHAT_MESSAGE_COST_CREDITS,
  );
  if (!deduct.ok) {
    const guestNeedsSignup =
      deduct.reason === "insufficient" && isGuestAuthUser(user);
    const msg = guestNeedsSignup
      ? "Je credits zijn op. Maak een account aan om verder te chatten."
      : deduct.reason === "insufficient"
        ? `Niet genoeg credits (heb ${deduct.balance}, nodig ${CHAT_MESSAGE_COST_CREDITS})`
        : deduct.error ?? "Credits aftrekken mislukt";
    return NextResponse.json(
      {
        ok: false,
        error: msg,
        code: guestNeedsSignup ? "signup_required" : deduct.reason,
        currentBalance: deduct.balance,
        cost: CHAT_MESSAGE_COST_CREDITS,
      },
      { status: deduct.reason === "insufficient" ? 402 : 500 },
    );
  }

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
    await refundUserCredits(supabase, user.id, deduct.balanceBefore);
    return NextResponse.json(
      { ok: false, error: ie?.message ?? "Opslaan mislukt" },
      { status: 500 },
    );
  }

  const userMessage = messageRowToUi(insertedUser as ChatMessageRow);
  const newBalance = deduct.newBalance;

  try {
    await supersedeV2OpenFollowups(supabase, user.id, peerId);
  } catch {
    /* best effort */
  }

  // Non-AI peer: nothing more to do.
  if (!p.is_ai) {
    return NextResponse.json({
      ok: true,
      userMessage,
      peerMessage: null,
      newPeerMessages: [] as ChatMessage[],
      nextPendingAt: null,
      newBalance,
    });
  }

  if (isManualOperatorMode()) {
    const service = getServiceSupabase();
    if (service) {
      const preview = isImage ? "[afbeelding]" : (text || "").trim();
      await upsertOperatorQueueForUserMessage(service, {
        ownerUserId: user.id,
        peerId,
        messagePreview: preview,
        messageAt: insertedUser.created_at,
      });
      try {
        await notifyOperatorViaTelegram(service, {
          ownerUserId: user.id,
          peerId,
          messagePreview: preview,
        });
      } catch (e) {
        console.warn("[telegram] notify error", e);
      }
    }
    return NextResponse.json({
      ok: true,
      mode: "manual_operator",
      aiReplyGenerated: false,
      userMessage,
      peerMessage: null,
      newPeerMessages: [] as ChatMessage[],
      nextPendingAt: null,
      newBalance,
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
      newBalance,
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
  const burstCharCount = userBurstCharCount(history);
  const initialPacing = computeReplyPacing({
    personaId: peerId,
    turnIndex: priorAssistantTurns,
    userMessageChars: isImage ? 80 : burstCharCount || (text || "").length,
    replyChars: 0,
    nowLocal: new Date(),
    peerLastReplyAt: lastPeerReplyAt(history),
    occupation: personaOccupation,
    appVariant: peerAppVariant,
  });

  let peerMessage: ChatMessage | null = null;
  let nextPendingAt: string | null = null;

  // One Grok call per user burst: supersede older queued replies, wait a
  // short coalesce window, then deliver via the pending-replies pipeline.
  const queued = await queueCoalescedPeerReply(supabase, {
    ownerUserId: user.id,
    peerId,
    userMessageId: insertedUser.id,
    pacingDelayMs: initialPacing.delayMs,
    appVariant: peerAppVariant,
  });

  if (!queued.ok) {
    console.warn(
      "[conversations/messages POST] coalesced queue failed, sync fallback",
      peerId,
      queued.error,
    );
    const result = await generatePeerReply(supabase, {
      profile: p,
      history,
      ownerUserId: user.id,
      peerId,
      options: { triggerUserMessageId: insertedUser.id },
    });
    if (isPersistedPeerReply(result)) {
      peerMessage = messageRowToUi(result.assistantRow);
      if (result.additionalChunks > 0 && result.nextChunkAt) {
        nextPendingAt = result.nextChunkAt;
      }
    } else if (!result.ok) {
      warning = result.error;
    }
  } else {
    nextPendingAt = queued.scheduledAtIso;
    schedulePendingReplyDelivery({
      ownerUserId: user.id,
      peerId,
      profile: p,
      scheduledAtIso: queued.scheduledAtIso,
    });

    const syncBudgetMs =
      queued.coalesceDelayMs + queued.postGrokDelayMs + 90_000;
    if (syncBudgetMs <= syncThresholdMs) {
      if (queued.coalesceDelayMs > 0) {
        await sleep(queued.coalesceDelayMs);
      }
      try {
        const delivered = await processDuePendingReplies(supabase, {
          ownerUserId: user.id,
          peerId,
          profile: p,
        });
        if (queued.postGrokDelayMs > 0) {
          await sleep(queued.postGrokDelayMs);
        }
        const newUi = delivered.newPeerMessages.map(messageRowToUi);
        if (newUi.length > 0) {
          processedPeerMessages = [...processedPeerMessages, ...newUi];
          const peerOnly = newUi.filter((m) => m.sender === "peer");
          if (peerOnly.length > 0) {
            peerMessage = peerOnly[peerOnly.length - 1]!;
          }
        }
        if (delivered.nextPendingAt) {
          nextPendingAt = delivered.nextPendingAt;
        } else if (peerMessage) {
          nextPendingAt = null;
        }
      } catch (e) {
        console.warn(
          "[conversations/messages POST] coalesced deliver threw",
          peerId,
          e instanceof Error ? e.message : String(e),
        );
      }
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
    newBalance,
    ...(warning ? { warning } : {}),
  });
}
