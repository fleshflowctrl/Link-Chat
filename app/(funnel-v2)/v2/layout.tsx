import { FunnelViewportLock } from "@/components/funnel/funnel-viewport-lock";
import { FunnelConfigProvider } from "@/components/funnel/funnel-config-context";
import { AppVariantProvider } from "@/components/app-variant-provider";

export default function V2FunnelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppVariantProvider variant="v2">
      <FunnelConfigProvider variant="v2">
        <div data-app-variant="v2" data-funnel-variant="v2" className="v2-theme-root">
          <FunnelViewportLock>{children}</FunnelViewportLock>
        </div>
      </FunnelConfigProvider>
    </AppVariantProvider>
  );
}
