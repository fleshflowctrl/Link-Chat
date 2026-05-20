import { BottomNav } from "@/components/BottomNav";
import { AppVariantProvider } from "@/components/app-variant-provider";
import { VisitorTracker } from "@/components/analytics/visitor-tracker";
import { SessionSyncProvider } from "@/components/session-sync-provider";
import { V2_THEME } from "@/lib/v2-theme";

export default function AppV2ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Intentionally NOT async + NOT force-dynamic. The unread badge starts at
  // 0 and the BottomNav's mount-time client fetch overrides it in <100ms.
  // Keeping the layout static means every tab switch only re-renders the
  // page body, not the entire shell — navigation feels instant.
  return (
    <AppVariantProvider variant="v2">
      <div
        data-app-variant="v2"
        className="flex min-h-[100dvh] justify-center"
        style={{ backgroundColor: V2_THEME.bg }}
      >
        <div
          className="relative flex h-[100dvh] max-h-[100dvh] w-full min-h-0 max-w-[430px] flex-col overflow-hidden bg-canvas text-ink shadow-[0_0_0_1px_rgba(181,43,42,0.15),0_24px_60px_-20px_rgba(0,0,0,0.5)]"
        >
          <VisitorTracker variant="v2" />
          <SessionSyncProvider />
          <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
            {children}
          </main>
          <BottomNav
            basePath="/v2"
            accentColor={V2_THEME.red}
            navSurfaceClass="border-t border-[#B52B2A]/25 bg-[#1D1D1E]/95 backdrop-blur-md supports-[backdrop-filter]:bg-[#1D1D1E]/90"
            badgeRingClass="ring-[#1D1D1E]"
          />
        </div>
      </div>
    </AppVariantProvider>
  );
}
