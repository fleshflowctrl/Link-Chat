import {
  getThreadPreviewsSnapshot,
  subscribeThreadPreviews,
} from "@/lib/thread-preview-store";

/**
 * Server-rendered baseline so the dot is correct on first paint, even on
 * pages other than /messages. Updated by the (app) layout each navigation.
 */
let serverBaseline = 0;
const serverListeners = new Set<() => void>();

export function setServerUnreadBaseline(count: number) {
  const safe = Math.max(0, Math.floor(count));
  if (safe === serverBaseline) return;
  serverBaseline = safe;
  serverListeners.forEach((l) => l());
}

/**
 * Sum of per-thread unread counts. Source of truth is the per-user inbox:
 *   - SSR baseline counts threads whose latest message is from the peer.
 *   - Client overrides (thread-preview-store) reset to 0 when the inbox /
 *     thread is opened, so the badge clears immediately.
 */
export function getMessagesTabBadgeLabel(): string | null {
  const { byId } = getThreadPreviewsSnapshot();

  // If we have any client-side overrides at all, trust the store completely.
  // It's been hydrated by the messages page or chat view this session.
  const overrideIds = Object.keys(byId);
  if (overrideIds.length > 0) {
    let sum = 0;
    for (const id of overrideIds) {
      const o = byId[id];
      if (!o) continue;
      sum += o.unreadCount ?? 0;
    }
    if (sum <= 0) return null;
    return sum > 99 ? "99+" : String(sum);
  }

  // Otherwise fall back to the server baseline (badge persists cross-page).
  if (serverBaseline <= 0) return null;
  return serverBaseline > 99 ? "99+" : String(serverBaseline);
}

export function subscribeMessagesTabBadge(cb: () => void) {
  const offStore = subscribeThreadPreviews(cb);
  serverListeners.add(cb);
  return () => {
    offStore();
    serverListeners.delete(cb);
  };
}
