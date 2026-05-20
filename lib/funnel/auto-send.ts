const FUNNEL_AUTO_SEND_KEY = "whisper_funnel_auto_send";

export type FunnelAutoSend = {
  peerId: string;
  text: string;
};

export function queueFunnelAutoSend(peerId: string, text: string): void {
  if (typeof window === "undefined") return;
  const trimmed = text.trim();
  if (!peerId.trim() || !trimmed) return;
  try {
    sessionStorage.setItem(
      FUNNEL_AUTO_SEND_KEY,
      JSON.stringify({ peerId: peerId.trim(), text: trimmed }),
    );
  } catch {
    /* private mode */
  }
}

/** Returns the queued message only when it matches this chat thread. */
export function consumeFunnelAutoSend(peerId: string): FunnelAutoSend | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(FUNNEL_AUTO_SEND_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FunnelAutoSend;
    if (parsed.peerId !== peerId || !parsed.text?.trim()) return null;
    sessionStorage.removeItem(FUNNEL_AUTO_SEND_KEY);
    return { peerId: parsed.peerId, text: parsed.text.trim() };
  } catch {
    return null;
  }
}
