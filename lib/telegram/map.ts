import type { SupabaseClient } from "@supabase/supabase-js";
import { encodeConversationId } from "@/lib/operator/conversation-key";

export async function saveTelegramConversationMap(
  supabase: SupabaseClient,
  input: {
    telegramChatId: number;
    telegramMessageId: number;
    ownerUserId: string;
    peerId: string;
  },
): Promise<void> {
  const conversationId = encodeConversationId(
    input.ownerUserId,
    input.peerId,
  );
  const { error } = await supabase.from("chat_operator_telegram_map").upsert(
    {
      telegram_message_id: input.telegramMessageId,
      telegram_chat_id: input.telegramChatId,
      owner_user_id: input.ownerUserId,
      peer_id: input.peerId,
      conversation_id: conversationId,
    },
    { onConflict: "telegram_message_id" },
  );
  if (error) {
    console.warn("[telegram] map save failed", error.message);
  }
}

export type TelegramConversationLookup = {
  ownerUserId: string;
  peerId: string;
  conversationId: string;
};

export async function lookupTelegramConversation(
  supabase: SupabaseClient,
  telegramMessageId: number,
): Promise<TelegramConversationLookup | null> {
  const { data, error } = await supabase
    .from("chat_operator_telegram_map")
    .select("owner_user_id, peer_id, conversation_id")
    .eq("telegram_message_id", telegramMessageId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    ownerUserId: data.owner_user_id as string,
    peerId: data.peer_id as string,
    conversationId: data.conversation_id as string,
  };
}
