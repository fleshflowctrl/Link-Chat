/** Default pause after the user's last line before Grok runs (server + client). */
export const USER_BURST_COALESCE_MS_DEFAULT = 3_500;

/** Client-visible coalesce window (optional env override). */
export function clientUserBurstCoalesceMs(): number {
  const raw =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_CHAT_BURST_COALESCE_MS?.trim()
      : undefined;
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) {
      return Math.min(Math.round(n), 15_000);
    }
  }
  return USER_BURST_COALESCE_MS_DEFAULT;
}
