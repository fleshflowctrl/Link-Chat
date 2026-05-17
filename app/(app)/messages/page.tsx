import { MessagesView } from "@/components/messages/messages-view";

/** Client inbox + session cache — no blocking server fetch on tab switch. */
export default function MessagesPage() {
  return <MessagesView />;
}
