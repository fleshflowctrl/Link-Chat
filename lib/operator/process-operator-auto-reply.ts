import { waitUntil } from "@vercel/functions";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatMessageRow, ChatProfileRow } from "@/lib/chat/map-rows";
import {
  getOperatorAppSettings,
  resolveOperatorAiActorId,
} from "@/lib/operator/ai-auto-settings";
import { generateOperatorAutoReplyDraft } from "@/lib/operator/generate-reply-suggestions";
import { sendOperatorPeerReply } from "@/lib/operator/send-peer-reply";
import { logAiSuggestion } from "@/lib/operator/log";
import { encodeConversationId } from "@/lib/operator/conversation-key";
import {
  AUTO_REPLY_FAILURE_COOLDOWN_MS,
  clearAutoReplyCooldown,
  isAutoReplyOnCooldown,
  setAutoReplyCooldown,
} from "@/lib/operator/auto-reply-cooldown";

export type ProcessOperatorAutoReplyResult =
  | { ok: true; sent: true; text: string; conversationId: string }
  | { ok: true; sent: false; reason: string }
  | { ok: false; error: string };

const STALE_AI_PROCESSING_MS = 45_000;
const AUTO_REPLY_RETRY_MS = 400;
const AUTO_REPLY_MAX_TRIGGER_ATTEMPTS = 12;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Latest user bubble that still has no peer reply after it. */
export function findLatestUserMessageNeedingReply(
  history: ChatMessageRow[],
): ChatMessageRow | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const row = history[i];
    if (row.sender !== "me") continue;
    const hasPeerReplyAfter = history
      .slice(i + 1)
      .some((m) => m.sender === "peer");
    if (!hasPeerReplyAfter) return row;
  }
  return null;
}

async function claimQueueForAutoReply(
  supabase: SupabaseClient,
  ownerUserId: string,
  peerId: string,
): Promise<boolean> {
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("chat_operator_queue")
    .update({
      operator_status: "ai_processing",
      updated_at: now,
    })
    .eq("owner_user_id", ownerUserId)
    .eq("peer_id", peerId)
    .eq("needs_operator_reply", true)
    .in("operator_status", ["waiting_operator", "open", "replied"])
    .select("id")
    .maybeSingle();

  if (data) return true;

  const staleBefore = new Date(Date.now() - STALE_AI_PROCESSING_MS).toISOString();
  const { data: reclaimed } = await supabase
    .from("chat_operator_queue")
    .update({
      operator_status: "ai_processing",
      updated_at: now,
    })
    .eq("owner_user_id", ownerUserId)
    .eq("peer_id", peerId)
    .eq("needs_operator_reply", true)
    .eq("operator_status", "ai_processing")
    .lt("updated_at", staleBefore)
    .select("id")
    .maybeSingle();

  return Boolean(reclaimed);
}

/** Bust a dead ai_processing lock on one thread so a new attempt can claim it. */
async function requeueThreadForAutoReply(
  supabase: SupabaseClient,
  ownerUserId: string,
  peerId: string,
): Promise<void> {
  await supabase
    .from("chat_operator_queue")
    .update({
      operator_status: "waiting_operator",
      needs_operator_reply: true,
      updated_at: new Date().toISOString(),
    })
    .eq("owner_user_id", ownerUserId)
    .eq("peer_id", peerId)
    .in("operator_status", ["ai_processing", "replied"]);
}

/**
 * Threads left in ai_processing after a timed-out/crashed run block all new
 * auto-replies. Reset them so the batch processor and per-message trigger can
 * claim again.
 */
export async function resetStuckOperatorAutoReplyClaims(
  supabase: SupabaseClient,
  opts?: { forceAll?: boolean },
): Promise<number> {
  const now = new Date().toISOString();
  let q = supabase
    .from("chat_operator_queue")
    .update({
      operator_status: "waiting_operator",
      needs_operator_reply: true,
      updated_at: now,
    })
    .eq("operator_status", "ai_processing")
    .eq("needs_operator_reply", true);

  if (!opts?.forceAll) {
    const staleBefore = new Date(Date.now() - STALE_AI_PROCESSING_MS).toISOString();
    q = q.lt("updated_at", staleBefore);
  }

  const { data } = await q.select("id");
  return data?.length ?? 0;
}

async function releaseQueueClaim(
  supabase: SupabaseClient,
  ownerUserId: string,
  peerId: string,
  opts?: { cooldownMs?: number },
): Promise<void> {
  await supabase
    .from("chat_operator_queue")
    .update({
      operator_status: "waiting_operator",
      needs_operator_reply: true,
      updated_at: new Date().toISOString(),
    })
    .eq("owner_user_id", ownerUserId)
    .eq("peer_id", peerId)
    .eq("operator_status", "ai_processing");

  if (opts?.cooldownMs && opts.cooldownMs > 0) {
    setAutoReplyCooldown(ownerUserId, peerId, opts.cooldownMs);
  }
}

async function loadThreadHistory(
  supabase: SupabaseClient,
  ownerUserId: string,
  peerId: string,
): Promise<ChatMessageRow[]> {
  const { data: historyRows } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .eq("peer_id", peerId)
    .order("created_at", { ascending: true });

  return (historyRows ?? []) as ChatMessageRow[];
}

/** User sent another message while we were drafting — keep thread in the queue. */
async function reconcileQueueAfterAutoSend(
  supabase: SupabaseClient,
  ownerUserId: string,
  peerId: string,
  answeredMessageId: string,
): Promise<boolean> {
  const { data: answered } = await supabase
    .from("chat_messages")
    .select("created_at")
    .eq("id", answeredMessageId)
    .maybeSingle();

  if (!answered?.created_at) return false;

  const { data: queueRow } = await supabase
    .from("chat_operator_queue")
    .select("last_user_message_at")
    .eq("owner_user_id", ownerUserId)
    .eq("peer_id", peerId)
    .maybeSingle();

  const lastUserAt = (queueRow as { last_user_message_at?: string } | null)
    ?.last_user_message_at;
  if (!lastUserAt) return false;

  if (lastUserAt > String(answered.created_at)) {
    await supabase
      .from("chat_operator_queue")
      .update({
        needs_operator_reply: true,
        unread_for_operator: true,
        operator_status: "waiting_operator",
        updated_at: new Date().toISOString(),
      })
      .eq("owner_user_id", ownerUserId)
      .eq("peer_id", peerId);
    return true;
  }

  return false;
}

export async function processOperatorAutoReply(
  supabase: SupabaseClient,
  input: {
    ownerUserId: string;
    peerId: string;
    triggerUserMessageId?: string;
  },
): Promise<ProcessOperatorAutoReplyResult> {
  const settings = await getOperatorAppSettings(supabase);
  if (!settings.aiAutoReplyEnabled) {
    return { ok: true, sent: false, reason: "ai_auto_disabled" };
  }

  if (isAutoReplyOnCooldown(input.ownerUserId, input.peerId)) {
    return { ok: true, sent: false, reason: "cooldown" };
  }

  const claimed = await claimQueueForAutoReply(
    supabase,
    input.ownerUserId,
    input.peerId,
  );
  if (!claimed) {
    return { ok: true, sent: false, reason: "not_claimable" };
  }

  const conversationId = encodeConversationId(
    input.ownerUserId,
    input.peerId,
  );

  try {
    const { data: profile, error: pe } = await supabase
      .from("chat_profiles")
      .select("*")
      .eq("id", input.peerId)
      .maybeSingle();
    if (pe || !profile) {
      await releaseQueueClaim(supabase, input.ownerUserId, input.peerId);
      return { ok: false, error: "Peer niet gevonden" };
    }

    let history = await loadThreadHistory(
      supabase,
      input.ownerUserId,
      input.peerId,
    );

    const pendingUser = findLatestUserMessageNeedingReply(history);
    if (!pendingUser) {
      await releaseQueueClaim(supabase, input.ownerUserId, input.peerId);
      return { ok: true, sent: false, reason: "already_answered" };
    }

    let triggerUserMessageId = input.triggerUserMessageId ?? pendingUser.id;
    if (triggerUserMessageId !== pendingUser.id) {
      triggerUserMessageId = pendingUser.id;
    }

    const draft = await generateOperatorAutoReplyDraft(supabase, {
      profile: profile as ChatProfileRow,
      history,
      ownerUserId: input.ownerUserId,
      peerId: input.peerId,
      triggerUserMessageId,
    });

    if (!draft.ok) {
      await releaseQueueClaim(supabase, input.ownerUserId, input.peerId, {
        cooldownMs: AUTO_REPLY_FAILURE_COOLDOWN_MS,
      });
      console.warn("[operator-auto-reply] draft failed:", draft.error);
      return { ok: false, error: draft.error };
    }

    history = await loadThreadHistory(supabase, input.ownerUserId, input.peerId);
    const stillPending = findLatestUserMessageNeedingReply(history);
    if (!stillPending) {
      await releaseQueueClaim(supabase, input.ownerUserId, input.peerId);
      return { ok: true, sent: false, reason: "already_answered" };
    }
    if (stillPending.id !== triggerUserMessageId) {
      await releaseQueueClaim(supabase, input.ownerUserId, input.peerId);
      return processOperatorAutoReply(supabase, {
        ownerUserId: input.ownerUserId,
        peerId: input.peerId,
        triggerUserMessageId: stillPending.id,
      });
    }

    const operatorId = resolveOperatorAiActorId(settings);
    const sent = await sendOperatorPeerReply(supabase, {
      ownerUserId: input.ownerUserId,
      peerId: input.peerId,
      text: draft.text,
      operatorId,
      source: "operator_ai_auto",
    });

    if (!sent.ok) {
      await releaseQueueClaim(supabase, input.ownerUserId, input.peerId, {
        cooldownMs: AUTO_REPLY_FAILURE_COOLDOWN_MS,
      });
      return { ok: false, error: sent.error };
    }

    clearAutoReplyCooldown(input.ownerUserId, input.peerId);

    logAiSuggestion({
      conversationId,
      peerId: input.peerId,
      ownerUserId: input.ownerUserId,
      suggestionGenerated: true,
      sentAutomatically: true,
    });

    const needsFollowUp = await reconcileQueueAfterAutoSend(
      supabase,
      input.ownerUserId,
      input.peerId,
      triggerUserMessageId,
    );
    if (needsFollowUp) {
      const followUp = processOperatorAutoReply(supabase, {
        ownerUserId: input.ownerUserId,
        peerId: input.peerId,
      }).catch((e) => {
        console.warn("[operator-auto-reply] follow-up", e);
      });
      waitUntil(followUp);
    }

    return {
      ok: true,
      sent: true,
      text: draft.text,
      conversationId,
    };
  } catch (e) {
    await releaseQueueClaim(supabase, input.ownerUserId, input.peerId, {
      cooldownMs: AUTO_REPLY_FAILURE_COOLDOWN_MS,
    });
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export async function processPendingOperatorAutoReplies(
  supabase: SupabaseClient,
  opts?: { limit?: number; maxBatches?: number },
): Promise<{
  processed: number;
  sent: number;
  errors: string[];
  stuckClaimsReset: number;
}> {
  const settings = await getOperatorAppSettings(supabase);
  if (!settings.aiAutoReplyEnabled) {
    return { processed: 0, sent: 0, errors: [], stuckClaimsReset: 0 };
  }

  const stuckClaimsReset = await resetStuckOperatorAutoReplyClaims(supabase);

  const batchSize = opts?.limit ?? 8;
  const maxBatches = opts?.maxBatches ?? 8;
  let processed = 0;
  let sent = 0;
  const errors: string[] = [];

  for (let batch = 0; batch < maxBatches; batch++) {
    const { data: rows } = await supabase
      .from("chat_operator_queue")
      .select("owner_user_id, peer_id")
      .eq("needs_operator_reply", true)
      .in("operator_status", ["waiting_operator", "open", "replied"])
      .order("last_user_message_at", { ascending: true, nullsFirst: false })
      .limit(batchSize);

    if (!rows?.length) break;

    for (const row of rows) {
      if (isAutoReplyOnCooldown(row.owner_user_id as string, row.peer_id as string)) {
        continue;
      }

      processed += 1;
      const result = await processOperatorAutoReply(supabase, {
        ownerUserId: row.owner_user_id as string,
        peerId: row.peer_id as string,
      });
      if (!result.ok) {
        errors.push(result.error);
        continue;
      }
      if (result.sent) sent += 1;
    }

    if (rows.length < batchSize) break;
  }

  return { processed, sent, errors, stuckClaimsReset };
}

async function runAutoReplyWithRetries(
  supabase: SupabaseClient,
  input: {
    ownerUserId: string;
    peerId: string;
    triggerUserMessageId: string;
  },
): Promise<void> {
  for (let attempt = 0; attempt < AUTO_REPLY_MAX_TRIGGER_ATTEMPTS; attempt++) {
    const result = await processOperatorAutoReply(supabase, input);
    if (!result.ok) {
      console.warn("[operator-auto-reply]", result.error);
      return;
    }
    if (result.sent) return;
    if (result.reason === "already_answered" || result.reason === "ai_auto_disabled") {
      return;
    }
    if (result.reason === "cooldown") return;
    if (result.reason !== "not_claimable") return;

    await requeueThreadForAutoReply(
      supabase,
      input.ownerUserId,
      input.peerId,
    );
    await sleep(AUTO_REPLY_RETRY_MS);
  }
}

export async function maybeTriggerOperatorAutoReply(
  supabase: SupabaseClient,
  input: {
    ownerUserId: string;
    peerId: string;
    triggerUserMessageId: string;
  },
): Promise<void> {
  const settings = await getOperatorAppSettings(supabase);
  if (!settings.aiAutoReplyEnabled) return;

  const task = runAutoReplyWithRetries(supabase, input).catch((e) => {
    console.warn("[operator-auto-reply]", e);
  });
  waitUntil(task);
  await task;
}
