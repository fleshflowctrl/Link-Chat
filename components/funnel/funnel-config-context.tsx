"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { AppVariant } from "@/lib/app-variant";
import { DEFAULT_APP_VARIANT } from "@/lib/app-variant";
import {
  getFunnelVariantConfig,
  type FunnelVariantConfig,
} from "@/lib/funnel/variant-config";

const FunnelConfigContext = createContext<FunnelVariantConfig>(
  getFunnelVariantConfig(DEFAULT_APP_VARIANT),
);

export function FunnelConfigProvider({
  variant = DEFAULT_APP_VARIANT,
  children,
}: {
  variant?: AppVariant;
  children: ReactNode;
}) {
  const value = useMemo(() => getFunnelVariantConfig(variant), [variant]);
  return (
    <FunnelConfigContext.Provider value={value}>
      {children}
    </FunnelConfigContext.Provider>
  );
}

export function useFunnelConfig(): FunnelVariantConfig {
  return useContext(FunnelConfigContext);
}
