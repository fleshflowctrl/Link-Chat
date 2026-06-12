/** Best-effort fire-and-forget — record that the user saw this discover profile. */
export function postProfileSeen(profileId: string) {
  if (typeof window === "undefined" || !profileId) return;
  try {
    void fetch("/api/me/feed/seen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profileId }),
      credentials: "same-origin",
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
