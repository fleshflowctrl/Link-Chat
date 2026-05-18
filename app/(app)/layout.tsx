import { BottomNav } from "@/components/BottomNav";
import { SessionSyncProvider } from "@/components/session-sync-provider";
import { fetchUnreadInboxCountServer } from "@/lib/chat/server-data";

export const dynamic = "force-dynamic";

export default async function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialUnread = await fetchUnreadInboxCountServer();
  return (
    <div className="flex min-h-[100dvh] justify-center bg-[#E4DFD4]">
      {/* One viewport tall: main scrolls; bottom nav stays visible */}
      <div className="relative flex h-[100dvh] max-h-[100dvh] w-full min-h-0 max-w-[430px] flex-col overflow-hidden bg-canvas shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_24px_60px_-20px_rgba(60,40,20,0.12)]">
        <SessionSyncProvider />
        <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
          {children}
        </main>
        <BottomNav initialUnread={initialUnread} />
      </div>
    </div>
  );
}
