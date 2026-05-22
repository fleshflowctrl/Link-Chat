export type ConversationLabelInput = {
  ownerDisplayName: string;
  peerDisplayName: string;
  userEmail?: string | null;
  ownerAge?: number | null;
  ownerLocation?: string | null;
};

/** Short title for inbox list / Telegram topic (max ~64 chars). */
export function formatConversationShortLabel(input: ConversationLabelInput): string {
  const user = input.ownerDisplayName.trim() || "User";
  const meta: string[] = [];
  if (input.ownerAge != null && input.ownerAge > 0) meta.push(String(input.ownerAge));
  if (input.ownerLocation?.trim()) meta.push(input.ownerLocation.trim());
  const emailShort = input.userEmail?.split("@")[0];
  if (emailShort && !meta.length) meta.push(emailShort);

  const userPart = meta.length ? `${user} · ${meta.join(" · ")}` : user;
  const label = `${userPart} → ${input.peerDisplayName}`;
  return label.length > 120 ? `${label.slice(0, 117)}…` : label;
}

/** Operator context line under the chat header. */
export function formatOperatorContextLine(input: ConversationLabelInput): string {
  const parts: string[] = [];
  if (input.ownerAge != null && input.ownerAge > 0) parts.push(`${input.ownerAge} jaar`);
  if (input.ownerLocation?.trim()) parts.push(input.ownerLocation.trim());
  if (input.userEmail) parts.push(input.userEmail);
  return parts.join(" · ");
}

/** Last N lines for a compact recap above messages. */
export function formatRecentTranscript(
  messages: { sender: string; body?: string | null; kind?: string }[],
  opts?: { maxLines?: number; peerName?: string },
): string | null {
  const max = opts?.maxLines ?? 6;
  const tail = messages.slice(-max);
  if (!tail.length) return null;
  const peerName = opts?.peerName ?? "Profiel";
  return tail
    .map((m) => {
      const who = m.sender === "peer" ? peerName : "User";
      const text =
        m.body?.trim() ||
        (m.kind === "image" ? "📷 foto" : "");
      return `${who}: ${text.slice(0, 120)}`;
    })
    .join("\n");
}
