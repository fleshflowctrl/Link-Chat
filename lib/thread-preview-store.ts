/** Inbox row overrides (preview + optional stub meta for new threads). */

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

const STORAGE_KEY = "whisper_thread_previews";

function readPersisted(): Record<string, ThreadPreview> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, ThreadPreview>;
  } catch {
    return {};
  }
}

function writePersisted(byId: Record<string, ThreadPreview>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(byId));
  } catch {
    /* quota / privacy mode — survive gracefully */
  }
}

let snapshot: Snapshot = { version: 0, byId: readPersisted() };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
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
  writePersisted(byId);
  emit();
}

export function getThreadPreviewOverride(
  chatId: string,
): ThreadPreview | undefined {
  return snapshot.byId[chatId];
}
