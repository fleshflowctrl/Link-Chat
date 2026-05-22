import type { SupabaseClient } from "@supabase/supabase-js";
import { encodeConversationId } from "@/lib/operator/conversation-key";
import { formatConversationShortLabel } from "@/lib/operator/conversation-label";
import type { OwnerProfileSnippet } from "@/lib/operator/inbox-data";
import { getTelegramOperatorGroupChatId } from "@/lib/telegram/config";
import { telegramCreateForumTopic } from "@/lib/telegram/bot-api";

export type TelegramTopicRef = {
  conversationId: string;
  telegramChatId: number;
  messageThreadId: number;
  topicName: string;
};

export async function ensureTelegramForumTopic(
  supabase: SupabaseClient,
  input: {
    ownerUserId: string;
    peerId: string;
    peerDisplayName: string;
    owner: OwnerProfileSnippet;
    userEmail: string | null;
  },
): Promise<TelegramTopicRef | null> {
  const groupChatId = getTelegramOperatorGroupChatId();
  if (groupChatId == null) return null;

  const conversationId = encodeConversationId(input.ownerUserId, input.peerId);
  const topicName = formatConversationShortLabel({
    ownerDisplayName: input.owner.displayName,
    peerDisplayName: input.peerDisplayName,
    userEmail: input.userEmail,
    ownerAge: input.owner.age,
    ownerLocation: input.owner.location,
  });

  const { data: existing } = await supabase
    .from("chat_operator_telegram_topics")
    .select("telegram_chat_id, message_thread_id, topic_name")
    .eq("conversation_id", conversationId)
    .maybeSingle();

  if (existing) {
    return {
      conversationId,
      telegramChatId: existing.telegram_chat_id as number,
      messageThreadId: existing.message_thread_id as number,
      topicName: (existing.topic_name as string) || topicName,
    };
  }

  const created = await telegramCreateForumTopic({
    chatId: groupChatId,
    name: topicName,
  });
  if (!created.ok) {
    console.warn("[telegram] createForumTopic failed", created.description);
    return null;
  }

  const messageThreadId = created.result.message_thread_id;
  const { error } = await supabase.from("chat_operator_telegram_topics").insert({
    conversation_id: conversationId,
    owner_user_id: input.ownerUserId,
    peer_id: input.peerId,
    telegram_chat_id: groupChatId,
    message_thread_id: messageThreadId,
    topic_name: topicName,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.warn("[telegram] topic save failed", error.message);
    return {
      conversationId,
      telegramChatId: groupChatId,
      messageThreadId,
      topicName,
    };
  }

  return {
    conversationId,
    telegramChatId: groupChatId,
    messageThreadId,
    topicName,
  };
}

export async function lookupTelegramConversationByThread(
  supabase: SupabaseClient,
  telegramChatId: number,
  messageThreadId: number,
): Promise<{
  ownerUserId: string;
  peerId: string;
  conversationId: string;
} | null> {
  const { data, error } = await supabase
    .from("chat_operator_telegram_topics")
    .select("owner_user_id, peer_id, conversation_id")
    .eq("telegram_chat_id", telegramChatId)
    .eq("message_thread_id", messageThreadId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    ownerUserId: data.owner_user_id as string,
    peerId: data.peer_id as string,
    conversationId: data.conversation_id as string,
  };
}
