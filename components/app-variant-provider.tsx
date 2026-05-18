"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import {
  DEFAULT_APP_VARIANT,
  type AppVariant,
  variantBasePath,
} from "@/lib/app-variant";

type AppVariantContextValue = {
  variant: AppVariant;
  basePath: string;
};

const AppVariantContext = createContext<AppVariantContextValue>({
  variant: DEFAULT_APP_VARIANT,
  basePath: "",
});

export function AppVariantProvider({
  variant,
  children,
}: {
  variant: AppVariant;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ variant, basePath: variantBasePath(variant) }),
    [variant],
  );
  return (
    <AppVariantContext.Provider value={value}>
      {children}
    </AppVariantContext.Provider>
  );
}

export function useAppVariant(): AppVariantContextValue {
  return useContext(AppVariantContext);
}
