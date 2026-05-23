import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getAppBaseUrl,
  getTelegramOperatorChatIds,
  getTelegramOperatorGroupChatId,
  isTelegramOperatorEnabled,
  useTelegramForumTopics,
} from "@/lib/telegram/config";
import { telegramSendMessage } from "@/lib/telegram/bot-api";
import {
  escapeTelegramHtml,
  formatOperatorNotification,
} from "@/lib/telegram/format";
import { saveTelegramConversationMap } from "@/lib/telegram/map";
import {
  loadOwnerProfileSnippets,
  type OwnerProfileSnippet,
} from "@/lib/operator/inbox-data";
import { STARTING_USER_CREDITS } from "@/lib/credits/pricing";
import { ensureTelegramForumTopic } from "@/lib/telegram/topics";

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

  const ownerMap = await loadOwnerProfileSnippets(supabase, [input.ownerUserId]);
  const owner: OwnerProfileSnippet =
    ownerMap.get(input.ownerUserId) ?? {
      displayName: "Gebruiker",
      photoUrl: "",
      age: null,
      location: "",
      credits: STARTING_USER_CREDITS,
    };

  const inboxUrl = `${getAppBaseUrl()}/operator/inbox`;
  const forum = useTelegramForumTopics();
  const text = formatOperatorNotification({
    ownerDisplayName: owner.displayName,
    peerDisplayName: peerDisplayName!,
    userEmail: userEmail ?? null,
    ownerAge: owner.age,
    ownerLocation: owner.location,
    messagePreview: input.messagePreview,
    inboxUrl,
    useForumTopic: forum,
  });

  const groupChatId = getTelegramOperatorGroupChatId();

  if (forum && groupChatId != null) {
    const topic = await ensureTelegramForumTopic(supabase, {
      ownerUserId: input.ownerUserId,
      peerId: input.peerId,
      peerDisplayName: peerDisplayName!,
      owner,
      userEmail: userEmail ?? null,
    });
    if (topic) {
      const sent = await telegramSendMessage({
        chatId: topic.telegramChatId,
        messageThreadId: topic.messageThreadId,
        text: `👤 <b>User:</b> ${escapeTelegramHtml(input.messagePreview.slice(0, 500) || "(leeg)")}`,
        parseMode: "HTML",
      });
      if (!sent.ok) {
        console.warn("[telegram] topic notify failed", sent.description);
      } else {
        await saveTelegramConversationMap(supabase, {
          telegramChatId: topic.telegramChatId,
          telegramMessageId: sent.result.message_id,
          ownerUserId: input.ownerUserId,
          peerId: input.peerId,
        });
      }
      return;
    }
  }

  const chatIds = getTelegramOperatorChatIds();
  for (const chatId of chatIds) {
    if (groupChatId != null && chatId === groupChatId) continue;
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
