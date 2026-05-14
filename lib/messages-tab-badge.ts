/**
 * Source of truth for the bottom-nav messages badge.
 *
 * - The server (via SSR + `/api/me/unread-count` polling) supplies the unread
 *   count. The bottom nav layout sets this on every navigation and the bottom
 *   nav itself polls in the background to keep it fresh on every page.
 *
 * - In-session optimistic deltas (e.g. user just opened a chat → badge should
 *   drop instantly without waiting for the next poll) are applied via
 *   `applyOptimisticUnreadDelta`. They reset the next time the server pushes
 *   a fresh baseline.
 */
let serverBaseline = 0;
let optimisticDelta = 0;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function setServerUnreadBaseline(count: number) {
  const safe = Math.max(0, Math.floor(count));
  if (safe === serverBaseline && optimisticDelta === 0) return;
  serverBaseline = safe;
  optimisticDelta = 0;
  notify();
}

/**
 * Apply an in-session adjustment (typically `-1` when the user opens a chat)
 * so the badge updates instantly. The next server baseline replaces this.
 */
export function applyOptimisticUnreadDelta(delta: number) {
  if (!delta) return;
  optimisticDelta += delta;
  notify();
}

function effectiveCount(): number {
  return Math.max(0, serverBaseline + optimisticDelta);
}

export function getMessagesTabBadgeLabel(): string | null {
  const n = effectiveCount();
  if (n <= 0) return null;
  return n > 99 ? "99+" : String(n);
}

export function subscribeMessagesTabBadge(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
