/** App variant — production is v2-only; v1 kept for legacy DB/analytics values. */
export type AppVariant = "v1" | "v2";

export const APP_VARIANT_COOKIE = "whisper_app_variant";
export const APP_VARIANT_STORAGE = "whisper:app_variant";

export const DEFAULT_APP_VARIANT: AppVariant = "v2";

export function isAppVariant(v: string | null | undefined): v is AppVariant {
  return v === "v1" || v === "v2";
}

export function parseAppVariant(v: string | null | undefined): AppVariant {
  return isAppVariant(v) ? v : DEFAULT_APP_VARIANT;
}

/** Legacy: v2 routes no longer use a URL prefix. */
export function variantBasePath(_variant?: AppVariant): string {
  return "";
}

/** Normalize in-app paths (strip legacy `/v2` prefix). */
export function withVariantPath(path: string, _variant?: AppVariant): string {
  if (path.startsWith("/v2/")) return path.slice(3) || "/";
  if (path === "/v2") return "/";
  return path;
}

/** Production resolves to v2; pathname kept for legacy redirects only. */
export function variantFromPathname(_pathname?: string | null): AppVariant {
  return "v2";
}

/** Optional client hint on API fetches (`X-Whisper-App-Variant`). */
export const APP_VARIANT_REQUEST_HEADER = "x-whisper-app-variant";

/** Server: variant for the current request. */
export async function readServerAppVariant(): Promise<AppVariant> {
  return "v2";
}

/** Attach to client `fetch` calls so API routes resolve the v2 pool. */
export function appVariantFetchHeaders(
  _variant?: AppVariant,
): Record<string, string> {
  return { [APP_VARIANT_REQUEST_HEADER]: "v2" };
}

/** Client: read persisted variant (always v2 in production). */
export function readClientAppVariant(): AppVariant {
  return "v2";
}
