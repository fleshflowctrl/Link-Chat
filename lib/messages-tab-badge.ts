import { messageThreads } from "@/data/messages";
import {
  getThreadPreviewsSnapshot,
  subscribeThreadPreviews,
} from "@/lib/thread-preview-store";

/** Sum of per-thread unread counts (mock inbox + preview overrides). */
export function getMessagesTabBadgeLabel(): string | null {
  const { byId } = getThreadPreviewsSnapshot();
  let sum = 0;

  for (const t of messageThreads) {
    const o = byId[t.id];
    const u = o?.unreadCount !== undefined ? o.unreadCount : (t.unreadCount ?? 0);
    sum += u;
  }

  for (const id of Object.keys(byId)) {
    if (messageThreads.some((t) => t.id === id)) continue;
    const o = byId[id];
    if (!o) continue;
    sum += o.unreadCount ?? 1;
  }

  if (sum <= 0) return null;
  return sum > 99 ? "99+" : String(sum);
}

export function subscribeMessagesTabBadge(cb: () => void) {
  return subscribeThreadPreviews(cb);
}
