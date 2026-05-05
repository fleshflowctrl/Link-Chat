import { MessagesView } from "@/components/messages/messages-view";
import {
  fetchMessagesOnlineRailServer,
  fetchThreadListServer,
} from "@/lib/chat/server-data";
import { fetchUserCreditsServer } from "@/lib/me/server-profile";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const [threads, onlineRail, headerCredits] = await Promise.all([
    fetchThreadListServer(),
    fetchMessagesOnlineRailServer(),
    fetchUserCreditsServer(),
  ]);

  return (
    <MessagesView
      initialThreads={threads}
      onlineRailUsers={onlineRail}
      headerCredits={headerCredits}
    />
  );
}
