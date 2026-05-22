import { escapeTelegramHtml } from "@/lib/telegram/format-html";

export { escapeTelegramHtml };

export function formatOperatorNotification(input: {
  ownerDisplayName: string;
  peerDisplayName: string;
  userEmail: string | null;
  ownerAge?: number | null;
  ownerLocation?: string | null;
  messagePreview: string;
  inboxUrl: string;
  useForumTopic?: boolean;
}): string {
  const meta: string[] = [];
  if (input.ownerAge != null && input.ownerAge > 0) {
    meta.push(`${input.ownerAge}j`);
  }
  if (input.ownerLocation?.trim()) {
    meta.push(escapeTelegramHtml(input.ownerLocation.trim()));
  }
  const emailPart = input.userEmail
    ? escapeTelegramHtml(input.userEmail.split("@")[0] ?? input.userEmail)
    : "";
  if (emailPart && !meta.length) meta.push(emailPart);

  const userLabel = escapeTelegramHtml(input.ownerDisplayName.trim() || "User");
  const metaStr = meta.length ? ` (${meta.join(" · ")})` : "";
  const persona = escapeTelegramHtml(input.peerDisplayName);
  const title = `<b>${userLabel}${metaStr}</b>\n→ antwoord als <b>${persona}</b>`;

  const preview = escapeTelegramHtml(
    input.messagePreview.slice(0, 500) || "(leeg)",
  );

  const lines = [title, "", `<i>${preview}</i>`];

  if (input.useForumTopic) {
    lines.push("", "💬 Antwoord in <b>dit topic</b> (geen reply nodig).");
  } else {
    lines.push(
      "",
      "↩️ <b>Antwoord</b> door dit bericht te beantwoorden (reply).",
    );
  }

  lines.push(
    `🌐 <a href="${escapeTelegramHtml(input.inboxUrl)}">Operator inbox</a>`,
  );

  return lines.join("\n");
}
