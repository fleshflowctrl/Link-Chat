import { FunnelViewportLock } from "@/components/funnel/funnel-viewport-lock";

export default function FunnelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <FunnelViewportLock>{children}</FunnelViewportLock>;
}
