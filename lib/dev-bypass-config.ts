/** Cookie set by POST /api/dev/bypass — only honored when bypass feature is enabled. */
export const DEV_BYPASS_COOKIE = "whisper_dev_bypass";
export const DEV_BYPASS_VALUE = "1";

/** Local dev always; production only if ALLOW_TEST_BYPASS=1 (never enable on real prod). */
export function isDevBypassFeatureEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.ALLOW_TEST_BYPASS === "1"
  );
}
