import { ChatThreadLayoutShell } from "@/components/messages/chat-thread-layout-shell";

export default function MessageThreadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ChatThreadLayoutShell>{children}</ChatThreadLayoutShell>;
}
