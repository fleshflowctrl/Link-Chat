import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getTelegramAllowedChatIds,
  getTelegramOperatorGroupChatId,
  getTelegramOperatorUserId,
  isTelegramOperatorEnabled,
  useTelegramForumTopics,
} from "@/lib/telegram/config";
import type { TelegramMessage } from "@/lib/telegram/bot-api";
import { telegramSendMessage } from "@/lib/telegram/bot-api";
import { lookupTelegramConversation } from "@/lib/telegram/map";
import { lookupTelegramConversationByThread } from "@/lib/telegram/topics";
import { sendOperatorPeerReply } from "@/lib/operator/send-peer-reply";

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};

async function resolveConversation(
  supabase: SupabaseClient,
  msg: TelegramMessage,
): Promise<{ ownerUserId: string; peerId: string } | null> {
  const chatId = msg.chat.id;
  const groupId = getTelegramOperatorGroupChatId();
  const threadId = msg.message_thread_id;

  if (
    useTelegramForumTopics() &&
    groupId != null &&
    chatId === groupId &&
    threadId != null &&
    threadId > 0
  ) {
    const byThread = await lookupTelegramConversationByThread(
      supabase,
      chatId,
      threadId,
    );
    if (byThread) return byThread;
  }

  const replyTo = msg.reply_to_message;
  if (replyTo?.message_id) {
    const conv = await lookupTelegramConversation(
      supabase,
      replyTo.message_id,
    );
    if (conv) {
      return { ownerUserId: conv.ownerUserId, peerId: conv.peerId };
    }
  }

  return null;
}

export async function handleTelegramUpdate(
  supabase: SupabaseClient,
  update: TelegramUpdate,
): Promise<void> {
  const msg = update.message;
  if (!msg?.text || !msg.chat) return;

  const chatId = msg.chat.id;
  const allowed = getTelegramAllowedChatIds();

  if (!allowed.includes(chatId)) {
    if (msg.text === "/start" || msg.text.startsWith("/start ")) {
      await telegramSendMessage({
        chatId,
        text: `Je chat-id is: ${chatId}\n\nZet in TELEGRAM_OPERATOR_CHAT_IDS of TELEGRAM_OPERATOR_GROUP_CHAT_ID.`,
      });
    }
    return;
  }

  if (msg.text === "/start" || msg.text.startsWith("/start ")) {
    const forum = useTelegramForumTopics();
    await telegramSendMessage({
      chatId,
      text: forum
        ? `Operator-bot actief (forum topics).\nChat-id: ${chatId}\n\nAntwoord in het topic van een gesprek.`
        : `Operator-bot actief.\nChat-id: ${chatId}\n\nAntwoord op een melding (reply) om te reageren.`,
      messageThreadId: msg.message_thread_id,
    });
    return;
  }

  if (!isTelegramOperatorEnabled()) return;

  const conv = await resolveConversation(supabase, msg);
  if (!conv) {
    const forum = useTelegramForumTopics();
    await telegramSendMessage({
      chatId,
      text: forum
        ? "Open het juiste topic of antwoord op een user-melding in dat topic."
        : "↩️ Antwoord op een melding (reply) van een gebruiker.",
      replyToMessageId: msg.message_id,
      messageThreadId: msg.message_thread_id,
    });
    return;
  }

  const replyText = msg.text.trim();
  if (!replyText || replyText.startsWith("/")) {
    await telegramSendMessage({
      chatId,
      text: "Stuur gewone tekst als antwoord (geen commando).",
      replyToMessageId: msg.message_id,
      messageThreadId: msg.message_thread_id,
    });
    return;
  }

  const result = await sendOperatorPeerReply(supabase, {
    ownerUserId: conv.ownerUserId,
    peerId: conv.peerId,
    text: replyText,
    operatorId: getTelegramOperatorUserId(),
    source: "operator_telegram",
  });

  if (!result.ok) {
    await telegramSendMessage({
      chatId,
      text: `❌ Niet verstuurd: ${result.error}`,
      replyToMessageId: msg.message_id,
      messageThreadId: msg.message_thread_id,
    });
    return;
  }

  const preview =
    replyText.length > 80 ? `${replyText.slice(0, 77)}…` : replyText;
  await telegramSendMessage({
    chatId,
    text: `✅ Verstuurd als profiel: ${preview}`,
    replyToMessageId: msg.message_id,
    messageThreadId: msg.message_thread_id,
  });
}
