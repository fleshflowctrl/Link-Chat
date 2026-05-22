import type { SupabaseClient } from "@supabase/supabase-js";
import { encodeConversationId } from "@/lib/operator/conversation-key";
import { logManualOperatorMode } from "@/lib/operator/log";

export type OperatorQueueRow = {
  id: string;
  owner_user_id: string;
  peer_id: string;
  needs_operator_reply: boolean;
  assigned_operator_id: string | null;
  last_user_message_at: string | null;
  last_operator_reply_at: string | null;
  last_message_preview: string | null;
  unread_for_operator: boolean;
  operator_status: string;
  priority: number;
  created_at: string;
  updated_at: string;
};

export async function upsertOperatorQueueForUserMessage(
  supabase: SupabaseClient,
  input: {
    ownerUserId: string;
    peerId: string;
    messagePreview: string;
    messageAt: string;
  },
): Promise<{ ok: boolean; error?: string }> {
  const now = new Date().toISOString();
  const preview = input.messagePreview.slice(0, 280);
  const { error } = await supabase.from("chat_operator_queue").upsert(
    {
      owner_user_id: input.ownerUserId,
      peer_id: input.peerId,
      needs_operator_reply: true,
      unread_for_operator: true,
      operator_status: "waiting_operator",
      last_user_message_at: input.messageAt,
      last_message_preview: preview,
      updated_at: now,
    },
    { onConflict: "owner_user_id,peer_id" },
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  logManualOperatorMode({
    conversationId: encodeConversationId(input.ownerUserId, input.peerId),
    peerId: input.peerId,
    ownerUserId: input.ownerUserId,
    userMessageInserted: true,
    aiReplyGenerated: false,
    queuedForOperator: true,
  });

  return { ok: true };
}

/** Operator opened the thread (read); does not clear needs_operator_reply. */
export async function markOperatorThreadViewed(
  supabase: SupabaseClient,
  ownerUserId: string,
  peerId: string,
): Promise<void> {
  await supabase
    .from("chat_operator_queue")
    .update({
      unread_for_operator: false,
      updated_at: new Date().toISOString(),
    })
    .eq("owner_user_id", ownerUserId)
    .eq("peer_id", peerId)
    .eq("unread_for_operator", true);
}

export async function markOperatorReplied(
  supabase: SupabaseClient,
  input: {
    ownerUserId: string;
    peerId: string;
    operatorId: string;
  },
): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from("chat_operator_queue")
    .update({
      needs_operator_reply: false,
      unread_for_operator: false,
      operator_status: "replied",
      last_operator_reply_at: now,
      assigned_operator_id: input.operatorId,
      updated_at: now,
    })
    .eq("owner_user_id", input.ownerUserId)
    .eq("peer_id", input.peerId);
}

export async function cancelPendingAiForThread(
  supabase: SupabaseClient,
  ownerUserId: string,
  peerId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("chat_pending_replies")
    .update({
      status: "cancelled_manual_operator_mode",
      updated_at: new Date().toISOString(),
    })
    .eq("owner_user_id", ownerUserId)
    .eq("peer_id", peerId)
    .in("status", ["pending", "processing"])
    .select("id");

  if (error) {
    console.warn("[operator] cancel pending failed", error.message);
    return 0;
  }
  return data?.length ?? 0;
}

export async function cancelAllPendingAiGlobally(
  supabase: SupabaseClient,
): Promise<number> {
  const { data, error } = await supabase
    .from("chat_pending_replies")
    .update({
      status: "cancelled_manual_operator_mode",
      updated_at: new Date().toISOString(),
    })
    .in("status", ["pending", "processing"])
    .select("id");

  if (error) {
    console.warn("[operator] cancel all pending failed", error.message);
    return 0;
  }
  return data?.length ?? 0;
}

export async function closeOperatorConversation(
  supabase: SupabaseClient,
  ownerUserId: string,
  peerId: string,
): Promise<void> {
  await supabase
    .from("chat_operator_queue")
    .update({
      operator_status: "closed",
      needs_operator_reply: false,
      unread_for_operator: false,
      updated_at: new Date().toISOString(),
    })
    .eq("owner_user_id", ownerUserId)
    .eq("peer_id", peerId);
}
