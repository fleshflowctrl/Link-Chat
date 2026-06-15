import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatMessageRow } from "@/lib/chat/map-rows";
import { messageRowToUi } from "@/lib/chat/map-rows";
import type { ChatMessage } from "@/data/messages";
import { scheduleUnreadEmailNotification } from "@/lib/chat/schedule-unread-email-notification";
import {
  cancelPendingAiForThread,
  markOperatorReplied,
} from "@/lib/operator/queue";
import { logOperatorReply } from "@/lib/operator/log";
import { encodeConversationId } from "@/lib/operator/conversation-key";

export type SendOperatorPeerReplyInput = {
  ownerUserId: string;
  peerId: string;
  text: string;
  /** Admin user id from site, or null for Telegram-only replies. */
  operatorId: string | null;
  source?: "operator_manual" | "operator_telegram" | "operator_ai_auto";
};

export type SendOperatorPeerReplyResult =
  | { ok: true; peerMessage: ChatMessage }
  | { ok: false; error: string; status?: number };

const MAX_LEN = 4000;

/** Insert a manual persona reply — shared by web operator API and Telegram webhook. */
export async function sendOperatorPeerReply(
  supabase: SupabaseClient,
  input: SendOperatorPeerReplyInput,
): Promise<SendOperatorPeerReplyResult> {
  const text = input.text.trim();
  if (!text) {
    return { ok: false, error: "Tekst ontbreekt", status: 400 };
  }
  if (text.length > MAX_LEN) {
    return { ok: false, error: "Tekst te lang", status: 400 };
  }

  const messageSource = input.source ?? "operator_manual";

  const { data: inserted, error: insErr } = await supabase
    .from("chat_messages")
    .insert({
      peer_id: input.peerId,
      owner_user_id: input.ownerUserId,
      sender: "peer",
      kind: "text",
      body: text,
      message_source: messageSource,
    })
    .select("*")
    .single();

  if (insErr || !inserted) {
    return {
      ok: false,
      error: insErr?.message ?? "Insert mislukt",
      status: 500,
    };
  }

  await cancelPendingAiForThread(supabase, input.ownerUserId, input.peerId);

  const peerMessageId = (inserted as ChatMessageRow).id;
  void scheduleUnreadEmailNotification(supabase, {
    ownerUserId: input.ownerUserId,
    peerId: input.peerId,
    peerMessageId,
  }).catch((e) => {
    console.warn("[operator] unread-email schedule", e);
  });

  if (input.operatorId) {
    await markOperatorReplied(supabase, {
      ownerUserId: input.ownerUserId,
      peerId: input.peerId,
      operatorId: input.operatorId,
      messagePreview: text,
    });
  } else {
    const now = new Date().toISOString();
    await supabase
      .from("chat_operator_queue")
      .update({
        needs_operator_reply: false,
        unread_for_operator: false,
        operator_status: "replied",
        last_operator_reply_at: now,
        last_message_preview: text.slice(0, 280),
        updated_at: now,
      })
      .eq("owner_user_id", input.ownerUserId)
      .eq("peer_id", input.peerId);
  }

  const conversationId = encodeConversationId(
    input.ownerUserId,
    input.peerId,
  );
  logOperatorReply({
    conversationId,
    peerId: input.peerId,
    ownerUserId: input.ownerUserId,
    operatorId: input.operatorId ?? "telegram",
    messageInserted: true,
  });

  return {
    ok: true,
    peerMessage: messageRowToUi(inserted as ChatMessageRow),
  };
}
