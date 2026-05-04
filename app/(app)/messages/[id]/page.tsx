import { ChatConversationView } from "@/components/messages/chat-conversation-view";
import { fetchConversationServer } from "@/lib/chat/server-data";

export const dynamic = "force-dynamic";

type Props = { params: { id: string } };

export default async function MessageThreadPage({ params }: Props) {
  const { messages, meta, useSupabase } = await fetchConversationServer(
    params.id,
  );
  return (
    <ChatConversationView
      key={params.id}
      chatId={params.id}
      initialMessages={messages}
      threadMeta={meta}
      useSupabase={useSupabase}
    />
  );
}
