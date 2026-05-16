/** Inbox row overrides (preview + optional stub meta for new threads).
 *
 * Persisted per Supabase user id so two accounts in the same browser
 * never share an inbox cache. */

export type ThreadPreview = {
  lastMessage: string;
  timestampLabel: string;
  /** ISO time for sorting; set when the user sends so the row jumps to the top */
  lastActivityAt?: string;
  name?: string;
  avatarUrl?: string;
  verified?: boolean;
  showOnlineDot?: boolean;
  /** When set, overrides inbox row unread badge (merged with `MessageThread`). */
  unreadCount?: number;
};

type Snapshot = { version: number; byId: Record<string, ThreadPreview> };

const STORAGE_KEY_PREFIX = "whisper_thread_previews";
/** Legacy global key — no longer written; cleared on logout / new account. */
const LEGACY_STORAGE_KEY = "whisper_thread_previews";

let activeUserKey = "guest";
let snapshot: Snapshot = { version: 0, byId: {} };
const listeners = new Set<() => void>();

function storageKey(userKey: string): string {
  return `${STORAGE_KEY_PREFIX}:${userKey}`;
}

function readPersisted(userKey: string): Record<string, ThreadPreview> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(storageKey(userKey));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, ThreadPreview>;
  } catch {
    return {};
  }
}

function writePersisted(userKey: string, byId: Record<string, ThreadPreview>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(userKey), JSON.stringify(byId));
  } catch {
    /* quota / privacy mode — survive gracefully */
  }
}

function emit() {
  listeners.forEach((l) => l());
}

/** Re-load previews for a different signed-in user (or guest). */
export function switchThreadPreviewsUser(userKey: string): void {
  const key = userKey && userKey.length > 0 ? userKey : "guest";
  if (key === activeUserKey && snapshot.version > 0) return;
  activeUserKey = key;
  snapshot = { version: snapshot.version + 1, byId: readPersisted(key) };
  emit();
}

/** Remove all persisted preview blobs (logout / fresh signup). */
export function clearAllThreadPreviewStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (
        k === LEGACY_STORAGE_KEY ||
        k?.startsWith(`${STORAGE_KEY_PREFIX}:`)
      ) {
        keysToRemove.push(k);
      }
    }
    for (const k of keysToRemove) {
      window.localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
  activeUserKey = "guest";
  snapshot = { version: snapshot.version + 1, byId: {} };
  emit();
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
  writePersisted(activeUserKey, byId);
  emit();
}

export function getThreadPreviewOverride(
  chatId: string,
): ThreadPreview | undefined {
  return snapshot.byId[chatId];
}
