"use client";

const STORAGE_KEY = "whisper:vid";

function generateUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback (very old browsers): RFC4122 v4-ish
  const rnd = (n: number) =>
    Array.from({ length: n }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join("");
  return `${rnd(8)}-${rnd(4)}-4${rnd(3)}-a${rnd(3)}-${rnd(12)}`;
}

/** Returns a stable per-browser UUID, creating one on first call. */
export function getOrCreateVisitorId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const fresh = generateUuid();
    window.localStorage.setItem(STORAGE_KEY, fresh);
    return fresh;
  } catch {
    return null;
  }
}

/** Fire-and-forget visitor ping. Safe to call repeatedly. */
export async function trackVisit(): Promise<void> {
  const visitorId = getOrCreateVisitorId();
  if (!visitorId) return;
  try {
    await fetch("/api/track/visit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        visitorId,
        referrer:
          typeof document !== "undefined" ? document.referrer || null : null,
      }),
      keepalive: true,
    });
  } catch {
    // Tracking is best-effort: never break UX.
  }
}

/** Links the current visitor to a newly signed-up user. */
export async function trackSignupLink(userId: string | null): Promise<void> {
  const visitorId = getOrCreateVisitorId();
  if (!visitorId) return;
  try {
    await fetch("/api/track/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ visitorId, userId: userId ?? undefined }),
      keepalive: true,
    });
  } catch {
    // Best-effort.
  }
}
