/** In-memory overrides for message list previews (last line + time). */

export type ThreadPreview = { lastMessage: string; timestampLabel: string };

type Snapshot = { version: number; byId: Record<string, ThreadPreview> };

let snapshot: Snapshot = { version: 0, byId: {} };
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
  snapshot = {
    version: snapshot.version + 1,
    byId: { ...snapshot.byId, [chatId]: p },
  };
  emit();
}

export function getThreadPreviewOverride(
  chatId: string,
): ThreadPreview | undefined {
  return snapshot.byId[chatId];
}
