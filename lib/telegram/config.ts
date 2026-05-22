/** Telegram operator bot — optional; when unset, Telegram features are disabled. */

export function getTelegramBotToken(): string | null {
  const t = process.env.TELEGRAM_BOT_TOKEN?.trim();
  return t || null;
}

/** Comma-separated Telegram chat ids allowed to send operator replies. */
export function getTelegramOperatorChatIds(): number[] {
  const raw = process.env.TELEGRAM_OPERATOR_CHAT_IDS?.trim();
  if (!raw) return [];
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));
}

/** Supergroup with Topics enabled — one topic per app conversation. */
export function getTelegramOperatorGroupChatId(): number | null {
  const raw = process.env.TELEGRAM_OPERATOR_GROUP_CHAT_ID?.trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Private operator chats + optional group id for incoming message auth. */
export function getTelegramAllowedChatIds(): number[] {
  const ids = new Set(getTelegramOperatorChatIds());
  const group = getTelegramOperatorGroupChatId();
  if (group != null) ids.add(group);
  return Array.from(ids);
}

export function isTelegramOperatorEnabled(): boolean {
  return Boolean(
    getTelegramBotToken() &&
      (getTelegramOperatorChatIds().length > 0 ||
        getTelegramOperatorGroupChatId() != null),
  );
}

export function useTelegramForumTopics(): boolean {
  return Boolean(getTelegramBotToken() && getTelegramOperatorGroupChatId() != null);
}

export function getTelegramWebhookSecret(): string | null {
  const s = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  return s || null;
}

/** Optional Supabase auth user id to store as assigned_operator_id for Telegram replies. */
export function getTelegramOperatorUserId(): string | null {
  const id = process.env.TELEGRAM_OPERATOR_USER_ID?.trim();
  return id || null;
}

export function getAppBaseUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.VERCEL_URL?.trim();
  if (!url) return "http://localhost:3000";
  if (url.startsWith("http")) return url.replace(/\/$/, "");
  return `https://${url.replace(/\/$/, "")}`;
}

export function getTelegramWebhookUrl(): string {
  return `${getAppBaseUrl()}/api/telegram/webhook`;
}
