import { getTelegramBotToken } from "@/lib/telegram/config";

export type TelegramApiResult<T> =
  | { ok: true; result: T }
  | { ok: false; description: string };

async function telegramRequest<T>(
  method: string,
  body?: Record<string, unknown>,
): Promise<TelegramApiResult<T>> {
  const token = getTelegramBotToken();
  if (!token) {
    return { ok: false, description: "TELEGRAM_BOT_TOKEN ontbreekt" };
  }

  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  let json: { ok?: boolean; result?: T; description?: string };
  try {
    json = (await res.json()) as typeof json;
  } catch {
    return { ok: false, description: `Telegram HTTP ${res.status}` };
  }

  if (!json.ok || json.result === undefined) {
    return {
      ok: false,
      description: json.description ?? `Telegram ${method} mislukt`,
    };
  }
  return { ok: true, result: json.result };
}

export type TelegramMessage = {
  message_id: number;
  chat: { id: number; type: string };
  text?: string;
  reply_to_message?: TelegramMessage;
};

export async function telegramSendMessage(input: {
  chatId: number;
  text: string;
  replyToMessageId?: number;
  parseMode?: "HTML" | "MarkdownV2";
}): Promise<TelegramApiResult<TelegramMessage>> {
  const body: Record<string, unknown> = {
    chat_id: input.chatId,
    text: input.text,
    disable_web_page_preview: true,
  };
  if (input.parseMode) {
    body.parse_mode = input.parseMode;
  }
  if (input.replyToMessageId != null) {
    body.reply_to_message_id = input.replyToMessageId;
  }
  return telegramRequest<TelegramMessage>("sendMessage", body);
}

export async function telegramSetWebhook(input: {
  url: string;
  secretToken?: string;
}): Promise<TelegramApiResult<boolean>> {
  const body: Record<string, unknown> = { url: input.url };
  if (input.secretToken) {
    body.secret_token = input.secretToken;
  }
  return telegramRequest<boolean>("setWebhook", body);
}

export async function telegramGetWebhookInfo(): Promise<
  TelegramApiResult<{
    url: string;
    has_custom_certificate: boolean;
    pending_update_count: number;
    last_error_date?: number;
    last_error_message?: string;
  }>
> {
  return telegramRequest("getWebhookInfo");
}

export async function telegramDeleteWebhook(): Promise<
  TelegramApiResult<boolean>
> {
  return telegramRequest<boolean>("deleteWebhook");
}
