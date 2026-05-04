import { ChatConversationView } from "@/components/messages/chat-conversation-view";

type Props = { params: { id: string } };

export default function MessageThreadPage({ params }: Props) {
  return <ChatConversationView key={params.id} chatId={params.id} />;
}
