import { BottomNav } from "@/components/BottomNav";
import { AppVariantProvider } from "@/components/app-variant-provider";
import { VisitorTracker } from "@/components/analytics/visitor-tracker";
import { SessionSyncProvider } from "@/components/session-sync-provider";
import { V2_THEME } from "@/lib/v2-theme";
import { APP_SHELL_WIDTH_CLASS } from "@/lib/responsive-shell";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppVariantProvider variant="v2">
      <div
        data-app-variant="v2"
        className="flex min-h-[100dvh] justify-center md:px-4 lg:px-6"
        style={{ backgroundColor: V2_THEME.bg }}
      >
        <div
          className={`relative flex h-[100dvh] max-h-[100dvh] min-h-0 flex-col overflow-hidden bg-canvas text-ink shadow-[0_0_0_1px_rgba(181,43,42,0.15),0_24px_60px_-20px_rgba(0,0,0,0.5)] ${APP_SHELL_WIDTH_CLASS}`}
        >
          <VisitorTracker variant="v2" />
          <SessionSyncProvider />
          <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain">
            {children}
          </main>
          <BottomNav
            accentColor={V2_THEME.red}
            navSurfaceClass="border-t border-[#B52B2A]/25 bg-[#1D1D1E]/95 backdrop-blur-md supports-[backdrop-filter]:bg-[#1D1D1E]/90"
            badgeRingClass="ring-[#1D1D1E]"
          />
        </div>
      </div>
    </AppVariantProvider>
  );
}
