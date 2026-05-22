import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getAppBaseUrl,
  getTelegramOperatorChatIds,
  isTelegramOperatorEnabled,
} from "@/lib/telegram/config";
import { telegramSendMessage } from "@/lib/telegram/bot-api";
import { formatOperatorNotification } from "@/lib/telegram/format";
import { saveTelegramConversationMap } from "@/lib/telegram/map";

export async function notifyOperatorViaTelegram(
  supabase: SupabaseClient,
  input: {
    ownerUserId: string;
    peerId: string;
    messagePreview: string;
    peerDisplayName?: string;
    userEmail?: string | null;
  },
): Promise<void> {
  if (!isTelegramOperatorEnabled()) return;

  let peerDisplayName = input.peerDisplayName;
  if (!peerDisplayName) {
    const { data: profile } = await supabase
      .from("chat_profiles")
      .select("display_name")
      .eq("id", input.peerId)
      .maybeSingle();
    peerDisplayName = (profile?.display_name as string) ?? "Profiel";
  }

  let userEmail = input.userEmail;
  if (userEmail === undefined) {
    const { data: authData } = await supabase.auth.admin.getUserById(
      input.ownerUserId,
    );
    userEmail = authData?.user?.email ?? null;
  }

  const inboxUrl = `${getAppBaseUrl()}/operator/inbox`;
  const text = formatOperatorNotification({
    peerDisplayName,
    userEmail: userEmail ?? null,
    messagePreview: input.messagePreview,
    inboxUrl,
  });

  const chatIds = getTelegramOperatorChatIds();
  for (const chatId of chatIds) {
    const sent = await telegramSendMessage({
      chatId,
      text,
      parseMode: "HTML",
    });
    if (!sent.ok) {
      console.warn("[telegram] notify failed", chatId, sent.description);
      continue;
    }
    await saveTelegramConversationMap(supabase, {
      telegramChatId: chatId,
      telegramMessageId: sent.result.message_id,
      ownerUserId: input.ownerUserId,
      peerId: input.peerId,
    });
  }
}
