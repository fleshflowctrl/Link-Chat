import {
  getTelegramOperatorChatIds,
  isTelegramOperatorEnabled,
} from "@/lib/telegram/config";
import { telegramSendMessage } from "@/lib/telegram/bot-api";
import { escapeTelegramHtml } from "@/lib/telegram/format-html";

export const SIGNUP_TELEGRAM_TITLE = "🎉🎉🎉";

export type SignupTelegramNotifyInput = {
  email: string;
  nickname?: string;
  age?: number;
  city?: string;
  gender?: string;
  seekingGender?: string;
};

function genderLabel(gender?: string): string {
  if (gender === "man") return "Man";
  if (gender === "woman") return "Vrouw";
  return "—";
}

function seekingLabel(seeking?: string): string {
  if (seeking === "men") return "mannen";
  if (seeking === "women") return "vrouwen";
  return "—";
}

function formatSignupTelegramText(input: SignupTelegramNotifyInput): string {
  const lines = [`<b>${escapeTelegramHtml(SIGNUP_TELEGRAM_TITLE)}</b>`, ""];

  if (input.nickname) {
    lines.push(`Naam: ${escapeTelegramHtml(input.nickname)}`);
  }
  if (typeof input.age === "number" && Number.isFinite(input.age)) {
    lines.push(`Leeftijd: ${Math.floor(input.age)}`);
  }
  if (input.city) {
    lines.push(`Stad: ${escapeTelegramHtml(input.city)}`);
  }
  if (input.gender || input.seekingGender) {
    lines.push(
      `Profiel: ${genderLabel(input.gender)} · zoekt ${seekingLabel(input.seekingGender)}`,
    );
  }
  lines.push(`E-mail: ${escapeTelegramHtml(input.email)}`);

  return lines.join("\n");
}

/** Fire-and-forget alert to TELEGRAM_OPERATOR_CHAT_IDS on new permanent signup. */
export async function notifySignupViaTelegram(
  input: SignupTelegramNotifyInput,
): Promise<void> {
  if (!isTelegramOperatorEnabled()) return;

  const text = formatSignupTelegramText(input);
  for (const chatId of getTelegramOperatorChatIds()) {
    const sent = await telegramSendMessage({
      chatId,
      text,
      parseMode: "HTML",
    });
    if (!sent.ok) {
      console.warn("[telegram] signup notify failed", chatId, sent.description);
    }
  }
}
