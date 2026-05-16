/** In-memory inbox overrides for optimistic UI during the current session.
 *
 * NOT persisted — thread list and unread state come from Supabase
 * (`chat_messages`, `chat_reads`) via /api/me/threads. Phone and laptop
 * always see the same data after a refetch. */

export type ThreadPreview = {
  lastMessage: string;
  timestampLabel: string;
  /** ISO time for sorting; set when the user sends so the row jumps to the top */
  lastActivityAt?: string;
  name?: string;
  avatarUrl?: string;
  verified?: boolean;
  showOnlineDot?: boolean;
  /** When set, overrides inbox row unread badge until the next server sync. */
  unreadCount?: number;
};

type Snapshot = { version: number; byId: Record<string, ThreadPreview> };

let snapshot: Snapshot = { version: 0, byId: {} };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

/** Clear in-memory previews (logout / user switch). */
export function clearThreadPreviews(): void {
  snapshot = { version: snapshot.version + 1, byId: {} };
  emit();
}

/** @deprecated Alias — no localStorage to clear anymore. */
export function clearAllThreadPreviewStorage(): void {
  clearThreadPreviews();
}

/** @deprecated No persisted per-user store — clears memory only. */
export function switchThreadPreviewsUser(_userKey: string): void {
  clearThreadPreviews();
}

export function subscribeThreadPreviews(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getThreadPreviewsSnapshot(): Snapshot {
  return snapshot;
}

export function setThreadPreview(chatId: string, p: ThreadPreview) {
  const byId = { ...snapshot.byId, [chatId]: p };
  snapshot = { version: snapshot.version + 1, byId };
  emit();
}

export function getThreadPreviewOverride(
  chatId: string,
): ThreadPreview | undefined {
  return snapshot.byId[chatId];
}
