import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getTelegramOperatorChatIds,
  getTelegramOperatorUserId,
  isTelegramOperatorEnabled,
} from "@/lib/telegram/config";
import type { TelegramMessage } from "@/lib/telegram/bot-api";
import { telegramSendMessage } from "@/lib/telegram/bot-api";
import { lookupTelegramConversation } from "@/lib/telegram/map";
import { sendOperatorPeerReply } from "@/lib/operator/send-peer-reply";

export type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};

export async function handleTelegramUpdate(
  supabase: SupabaseClient,
  update: TelegramUpdate,
): Promise<void> {
  const msg = update.message;
  if (!msg?.text || !msg.chat) return;

  const chatId = msg.chat.id;
  const allowed = getTelegramOperatorChatIds();
  if (!allowed.includes(chatId)) {
    if (msg.text === "/start" || msg.text.startsWith("/start ")) {
      await telegramSendMessage({
        chatId,
        text: `Je chat-id is: ${chatId}\n\nZet deze in TELEGRAM_OPERATOR_CHAT_IDS op de server.`,
      });
    }
    return;
  }

  if (msg.text === "/start" || msg.text.startsWith("/start ")) {
    await telegramSendMessage({
      chatId,
      text: `Operator-bot actief.\nChat-id: ${chatId}\n\nAntwoord op een melding (reply) om als profiel te reageren in de app.`,
    });
    return;
  }

  if (!isTelegramOperatorEnabled()) return;

  const replyTo = msg.reply_to_message;
  if (!replyTo?.message_id) {
    await telegramSendMessage({
      chatId,
      text: "↩️ Antwoord op een melding (reply) van een gebruiker — dan weet ik welk gesprek het is.",
      replyToMessageId: msg.message_id,
    });
    return;
  }

  const conv = await lookupTelegramConversation(
    supabase,
    replyTo.message_id,
  );
  if (!conv) {
    await telegramSendMessage({
      chatId,
      text: "Dit bericht hoort niet bij een open gesprek (te oud of geen melding). Stuur een nieuw bericht in de app of gebruik de site-inbox.",
      replyToMessageId: msg.message_id,
    });
    return;
  }

  const replyText = msg.text.trim();
  if (!replyText || replyText.startsWith("/")) {
    await telegramSendMessage({
      chatId,
      text: "Stuur gewone tekst als antwoord (geen commando).",
      replyToMessageId: msg.message_id,
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
    });
    return;
  }

  const preview =
    replyText.length > 80 ? `${replyText.slice(0, 77)}…` : replyText;
  await telegramSendMessage({
    chatId,
    text: `✅ Verstuurd als profiel: ${preview}`,
    replyToMessageId: msg.message_id,
  });
}
