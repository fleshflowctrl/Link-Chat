/** Stable conversation id for operator APIs: ownerUserId + peerId. */

const SEP = "__";

export function encodeConversationId(ownerUserId: string, peerId: string): string {
  return `${ownerUserId}${SEP}${peerId}`;
}

export function decodeConversationId(
  conversationId: string,
): { ownerUserId: string; peerId: string } | null {
  const idx = conversationId.indexOf(SEP);
  if (idx <= 0 || idx >= conversationId.length - SEP.length) return null;
  const ownerUserId = conversationId.slice(0, idx);
  const peerId = conversationId.slice(idx + SEP.length);
  if (!ownerUserId || !peerId) return null;
  return { ownerUserId, peerId };
}
