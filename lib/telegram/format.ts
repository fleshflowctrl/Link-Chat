/** Escape for Telegram HTML parse_mode. */
export function escapeTelegramHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function formatOperatorNotification(input: {
  peerDisplayName: string;
  userEmail: string | null;
  messagePreview: string;
  inboxUrl: string;
}): string {
  const who = input.userEmail
    ? `${escapeTelegramHtml(input.peerDisplayName)} · ${escapeTelegramHtml(input.userEmail)}`
    : escapeTelegramHtml(input.peerDisplayName);
  const preview = escapeTelegramHtml(
    input.messagePreview.slice(0, 500) || "(leeg)",
  );
  return [
    `<b>💬 ${who}</b>`,
    "",
    `<i>${preview}</i>`,
    "",
    "↩️ <b>Antwoord</b> door dit bericht te beantwoorden (reply).",
    `🌐 <a href="${escapeTelegramHtml(input.inboxUrl)}">Operator inbox</a>`,
  ].join("\n");
}
