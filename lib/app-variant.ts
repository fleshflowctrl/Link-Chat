/** App A/B variant — v1 is the default production experience. */
export type AppVariant = "v1" | "v2";

export const APP_VARIANT_COOKIE = "whisper_app_variant";
export const APP_VARIANT_STORAGE = "whisper:app_variant";

export const DEFAULT_APP_VARIANT: AppVariant = "v1";

export function isAppVariant(v: string | null | undefined): v is AppVariant {
  return v === "v1" || v === "v2";
}

export function parseAppVariant(v: string | null | undefined): AppVariant {
  return isAppVariant(v) ? v : DEFAULT_APP_VARIANT;
}

/** URL prefix for in-app navigation (`""` for v1, `"/v2"` for v2). */
export function variantBasePath(variant: AppVariant): string {
  return variant === "v2" ? "/v2" : "";
}

/** Prefix a path with the variant base (`/discover` → `/v2/discover`). */
export function withVariantPath(path: string, variant: AppVariant): string {
  if (variant === "v1") return path;
  if (path.startsWith("/v2")) return path;
  return `/v2${path === "/" ? "" : path}`;
}

/** Detect variant from a Next.js pathname. */
export function variantFromPathname(pathname: string | null | undefined): AppVariant {
  if (!pathname) return DEFAULT_APP_VARIANT;
  return pathname === "/v2" || pathname.startsWith("/v2/") ? "v2" : "v1";
}

/** Server: variant for the current request (pathname via middleware header, else cookie). */
export async function readServerAppVariant(): Promise<AppVariant> {
  const { cookies, headers } = await import("next/headers");
  const h = await headers();
  const fromPath = h.get("x-app-variant");
  if (isAppVariant(fromPath)) return fromPath;
  const c = await cookies();
  return parseAppVariant(c.get(APP_VARIANT_COOKIE)?.value ?? null);
}

/** Client: read persisted variant (cookie set by middleware). */
export function readClientAppVariant(): AppVariant {
  if (typeof document === "undefined") return DEFAULT_APP_VARIANT;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${APP_VARIANT_COOKIE}=([^;]*)`),
  );
  return parseAppVariant(match?.[1] ? decodeURIComponent(match[1]) : null);
}
