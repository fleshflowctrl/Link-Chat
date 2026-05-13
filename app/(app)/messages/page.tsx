import { MessagesView } from "@/components/messages/messages-view";
import {
  fetchMessagesOnlineRailServer,
  fetchThreadListServer,
} from "@/lib/chat/server-data";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const [threads, onlineRail] = await Promise.all([
    fetchThreadListServer(),
    fetchMessagesOnlineRailServer(),
  ]);

  return (
    <MessagesView
      initialThreads={threads}
      onlineRailUsers={onlineRail}
    />
  );
}
