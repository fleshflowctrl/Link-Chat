"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { OnboardingFunnel } from "./onboarding-funnel";

/**
 * Tijdens ontwikkeling: funnel opnieuw bij elke bezoek aan home vanaf een andere route,
 * en bij elke volledige pagina-reload (state start opnieuw).
 * Later: zet op false en gebruik bv. localStorage om na eerste keer over te slaan.
 */
export const RESET_FUNNEL_WHEN_RETURNING_HOME = true;

export function OnboardingRootGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const prevPath = useRef<string | undefined>(undefined);
  const [funnelDone, setFunnelDone] = useState(false);

  useEffect(() => {
    if (!RESET_FUNNEL_WHEN_RETURNING_HOME) return;
    if (
      pathname === "/" &&
      prevPath.current !== undefined &&
      prevPath.current !== "/"
    ) {
      setFunnelDone(false);
    }
    prevPath.current = pathname;
  }, [pathname]);

  if (pathname !== "/") {
    return <>{children}</>;
  }

  if (!funnelDone) {
    return <OnboardingFunnel onComplete={() => setFunnelDone(true)} />;
  }

  return <>{children}</>;
}
