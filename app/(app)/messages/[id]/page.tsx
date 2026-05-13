import { notFound } from "next/navigation";
import { ChatConversationView } from "@/components/messages/chat-conversation-view";
import { fetchConversationServer } from "@/lib/chat/server-data";

type Props = { params: { id: string } };

export default async function MessageThreadPage({ params }: Props) {
  const data = await fetchConversationServer(params.id);
  if (data.notFound) notFound();
  return (
    <ChatConversationView
      key={params.id}
      chatId={params.id}
      initialMessages={data.messages}
      threadMeta={data.meta}
      useSupabase={data.useSupabase}
    />
  );
}
