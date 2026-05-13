import { MessagesView } from "@/components/messages/messages-view";
import { fetchThreadListServer } from "@/lib/chat/server-data";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const initialThreads = await fetchThreadListServer();
  return <MessagesView initialThreads={initialThreads} />;
}
