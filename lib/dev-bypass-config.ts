/** Cookie set by POST /api/dev/bypass — only honored when bypass is allowed for this host/env. */
export const DEV_BYPASS_COOKIE = "whisper_dev_bypass";
export const DEV_BYPASS_VALUE = "1";

export function isLocalhostHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const base = host.split(":")[0]?.toLowerCase() ?? "";
  return base === "localhost" || base === "127.0.0.1";
}

/** Default `*.vercel.app` URLs (incl. production) so test bypass works without extra env. */
export function isVercelAppHost(host: string | null | undefined): boolean {
  if (!host) return false;
  const base = host.split(":")[0]?.toLowerCase() ?? "";
  return base.endsWith(".vercel.app");
}

/** Explicit opt-in (server or public env) or Vercel preview. */
export function isDevBypassFeatureEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.ALLOW_TEST_BYPASS === "1" ||
    process.env.NEXT_PUBLIC_ALLOW_TEST_BYPASS === "true" ||
    process.env.VERCEL_ENV === "preview"
  );
}

/**
 * Whether we may set/honor the bypass cookie for this HTTP Host.
 * Localhost, Vercel’s default deployment host, or explicit env flags.
 */
export function canUseDevBypassForHost(host: string | null | undefined): boolean {
  return (
    isDevBypassFeatureEnabled() ||
    isLocalhostHost(host) ||
    isVercelAppHost(host)
  );
}
