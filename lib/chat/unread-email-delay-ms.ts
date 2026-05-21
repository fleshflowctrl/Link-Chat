/** Default 5 minutes before sending "new message" e-mail for unread peer messages. */
export const DEFAULT_CHAT_UNREAD_EMAIL_DELAY_MS = 5 * 60 * 1000;

export function chatUnreadEmailDelayMs(): number {
  const raw = process.env.CHAT_UNREAD_EMAIL_DELAY_MS?.trim();
  if (!raw) return DEFAULT_CHAT_UNREAD_EMAIL_DELAY_MS;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 60_000) return DEFAULT_CHAT_UNREAD_EMAIL_DELAY_MS;
  return Math.floor(n);
}
