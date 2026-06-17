const AUTO_REPLY_FAILURE_COOLDOWN_MS = 20_000;

const autoReplyCooldownUntil = new Map<string, number>();

function autoReplyCooldownKey(ownerUserId: string, peerId: string): string {
  return `${ownerUserId}__${peerId}`;
}

export function clearAutoReplyCooldown(
  ownerUserId: string,
  peerId: string,
): void {
  autoReplyCooldownUntil.delete(autoReplyCooldownKey(ownerUserId, peerId));
}

export function isAutoReplyOnCooldown(
  ownerUserId: string,
  peerId: string,
): boolean {
  const until = autoReplyCooldownUntil.get(
    autoReplyCooldownKey(ownerUserId, peerId),
  );
  return typeof until === "number" && Date.now() < until;
}

export function setAutoReplyCooldown(
  ownerUserId: string,
  peerId: string,
  ms = AUTO_REPLY_FAILURE_COOLDOWN_MS,
): void {
  autoReplyCooldownUntil.set(
    autoReplyCooldownKey(ownerUserId, peerId),
    Date.now() + ms,
  );
}

export { AUTO_REPLY_FAILURE_COOLDOWN_MS };
