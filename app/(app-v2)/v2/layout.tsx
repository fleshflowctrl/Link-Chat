import { BottomNav } from "@/components/BottomNav";
import { AppVariantProvider } from "@/components/app-variant-provider";
import { VisitorTracker } from "@/components/analytics/visitor-tracker";
import { SessionSyncProvider } from "@/components/session-sync-provider";
import { fetchUnreadInboxCountServer } from "@/lib/chat/server-data";

export const dynamic = "force-dynamic";

export default async function AppV2ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialUnread = await fetchUnreadInboxCountServer();
  return (
    <AppVariantProvider variant="v2">
      <div
        data-app-variant="v2"
        className="flex min-h-[100dvh] justify-center bg-[#0f0e0c]"
      >
        <div className="relative flex h-[100dvh] max-h-[100dvh] w-full min-h-0 max-w-[430px] flex-col overflow-hidden bg-canvas text-[var(--ink,#f5f0e6)] shadow-[0_0_0_1px_rgba(201,162,39,0.12),0_24px_60px_-20px_rgba(0,0,0,0.55)]">
          <VisitorTracker variant="v2" />
          <SessionSyncProvider />
          <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
            {children}
          </main>
          <BottomNav
            initialUnread={initialUnread}
            basePath="/v2"
            accentColor="#C9A227"
            navSurfaceClass="border-t border-[#c9a227]/20 bg-[#141210]/95 backdrop-blur-md supports-[backdrop-filter]:bg-[#141210]/90"
            badgeRingClass="ring-[#141210]"
          />
        </div>
      </div>
    </AppVariantProvider>
  );
}
