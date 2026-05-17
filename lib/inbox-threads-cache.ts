import type { MessageThread } from "@/data/messages";

const STORAGE_KEY = "whisper:inbox-threads:v1";

export function readInboxThreadsCache(): MessageThread[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { threads?: MessageThread[] };
    if (!Array.isArray(parsed.threads) || parsed.threads.length === 0) {
      return null;
    }
    return parsed.threads;
  } catch {
    return null;
  }
}

export function writeInboxThreadsCache(threads: MessageThread[]): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ threads, savedAt: Date.now() }),
    );
  } catch {
    /* quota / private mode */
  }
}

export function clearInboxThreadsCache(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
