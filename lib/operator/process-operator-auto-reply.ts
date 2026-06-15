import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatMessageRow, ChatProfileRow } from "@/lib/chat/map-rows";
import {
  getOperatorAppSettings,
  resolveOperatorAiActorId,
} from "@/lib/operator/ai-auto-settings";
import { generateOperatorReplySuggestions } from "@/lib/operator/generate-reply-suggestions";
import { pickBestOperatorSuggestion } from "@/lib/operator/pick-best-operator-suggestion";
import { sendOperatorPeerReply } from "@/lib/operator/send-peer-reply";
import { logAiSuggestion } from "@/lib/operator/log";
import { encodeConversationId } from "@/lib/operator/conversation-key";

export type ProcessOperatorAutoReplyResult =
  | { ok: true; sent: true; text: string; conversationId: string }
  | { ok: true; sent: false; reason: string }
  | { ok: false; error: string };

async function claimQueueForAutoReply(
  supabase: SupabaseClient,
  ownerUserId: string,
  peerId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("chat_operator_queue")
    .update({
      operator_status: "ai_processing",
      updated_at: new Date().toISOString(),
    })
    .eq("owner_user_id", ownerUserId)
    .eq("peer_id", peerId)
    .eq("needs_operator_reply", true)
    .in("operator_status", ["waiting_operator", "open"])
    .select("id")
    .maybeSingle();

  return Boolean(data);
}

async function releaseQueueClaim(
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
    .eq("operator_status", "ai_processing");
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

    const { data: historyRows } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("owner_user_id", input.ownerUserId)
      .eq("peer_id", input.peerId)
      .order("created_at", { ascending: true });

    const history = (historyRows ?? []) as ChatMessageRow[];
    const lastUser = [...history].reverse().find((m) => m.sender === "me");
    if (!lastUser) {
      await releaseQueueClaim(supabase, input.ownerUserId, input.peerId);
      return { ok: true, sent: false, reason: "no_user_message" };
    }

    const triggerUserMessageId = input.triggerUserMessageId ?? lastUser.id;

    const suggestions = await generateOperatorReplySuggestions(supabase, {
      profile: profile as ChatProfileRow,
      history,
      ownerUserId: input.ownerUserId,
      peerId: input.peerId,
      triggerUserMessageId,
    });

    if (!suggestions.ok) {
      await releaseQueueClaim(supabase, input.ownerUserId, input.peerId);
      return { ok: false, error: suggestions.error };
    }

    const picked = await pickBestOperatorSuggestion({
      profile: profile as ChatProfileRow,
      history,
      suggestions: suggestions.suggestions,
    });

    if (!picked.ok) {
      await releaseQueueClaim(supabase, input.ownerUserId, input.peerId);
      return { ok: false, error: picked.error };
    }

    const operatorId = resolveOperatorAiActorId(settings);
    const sent = await sendOperatorPeerReply(supabase, {
      ownerUserId: input.ownerUserId,
      peerId: input.peerId,
      text: picked.text,
      operatorId,
      source: "operator_ai_auto",
    });

    if (!sent.ok) {
      await releaseQueueClaim(supabase, input.ownerUserId, input.peerId);
      return { ok: false, error: sent.error };
    }

    logAiSuggestion({
      conversationId,
      peerId: input.peerId,
      ownerUserId: input.ownerUserId,
      suggestionGenerated: true,
      sentAutomatically: true,
    });

    return {
      ok: true,
      sent: true,
      text: picked.text,
      conversationId,
    };
  } catch (e) {
    await releaseQueueClaim(supabase, input.ownerUserId, input.peerId);
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export async function processPendingOperatorAutoReplies(
  supabase: SupabaseClient,
  opts?: { limit?: number },
): Promise<{
  processed: number;
  sent: number;
  errors: string[];
}> {
  const settings = await getOperatorAppSettings(supabase);
  if (!settings.aiAutoReplyEnabled) {
    return { processed: 0, sent: 0, errors: [] };
  }

  const limit = opts?.limit ?? 3;
  const { data: rows } = await supabase
    .from("chat_operator_queue")
    .select("owner_user_id, peer_id")
    .eq("needs_operator_reply", true)
    .in("operator_status", ["waiting_operator", "open"])
    .order("last_user_message_at", { ascending: true, nullsFirst: false })
    .limit(limit);

  let processed = 0;
  let sent = 0;
  const errors: string[] = [];

  for (const row of rows ?? []) {
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

  return { processed, sent, errors };
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

  void processOperatorAutoReply(supabase, input).catch((e) => {
    console.warn("[operator-auto-reply]", e);
  });
}
