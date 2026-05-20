import type { Profile } from "@/data/profiles";
import { HOURLY_FEED_SIZE } from "@/lib/catalog/hourly-feed";

/** Cookie + sessionStorage key for the profile chosen on funnel step 6. */
export const FUNNEL_PICKED_PEER_COOKIE = "whisper_funnel_picked_peer";
export const FUNNEL_PICKED_PEER_STORAGE_KEY = "whisper_funnel_picked_peer";

const COOKIE_MAX_AGE_SEC = 60 * 60;

/** Client: persist pick for the upcoming discover navigation. */
export function setFunnelPickedPeerClient(peerId: string): void {
  if (typeof window === "undefined" || !peerId.trim()) return;
  const id = peerId.trim();
  try {
    sessionStorage.setItem(FUNNEL_PICKED_PEER_STORAGE_KEY, id);
  } catch {
    /* private mode */
  }
  document.cookie = `${FUNNEL_PICKED_PEER_COOKIE}=${encodeURIComponent(id)}; path=/; max-age=${COOKIE_MAX_AGE_SEC}; samesite=lax`;
}

/** Client: read and clear one-time pick (fallback if SSR missed it). */
export function consumeFunnelPickedPeerClient(): string | null {
  if (typeof window === "undefined") return null;
  let id: string | null = null;
  try {
    id = sessionStorage.getItem(FUNNEL_PICKED_PEER_STORAGE_KEY);
    if (id) sessionStorage.removeItem(FUNNEL_PICKED_PEER_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  if (!id) {
    const match = document.cookie.match(
      new RegExp(`(?:^|; )${FUNNEL_PICKED_PEER_COOKIE}=([^;]*)`),
    );
    id = match?.[1] ? decodeURIComponent(match[1]) : null;
  }
  if (id) {
    document.cookie = `${FUNNEL_PICKED_PEER_COOKIE}=; path=/; max-age=0; samesite=lax`;
  }
  return id?.trim() || null;
}

/**
 * Server: read one-time funnel pick from cookie (read-only).
 * Do not call `cookies().delete()` here — Next.js only allows cookie writes in
 * Server Actions / Route Handlers; deleting during RSC (discover SSR) throws.
 * The client clears the cookie in `consumeFunnelPickedPeerClient`.
 */
export async function consumeFunnelPickedPeerServer(): Promise<string | null> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  const raw = store.get(FUNNEL_PICKED_PEER_COOKIE)?.value;
  if (!raw?.trim()) return null;
  try {
    return decodeURIComponent(raw.trim());
  } catch {
    return raw.trim();
  }
}

/**
 * Move the funnel pick to index 0. If it is missing from the feed but present
 * in the pool, prepend it and keep pack size capped.
 */
export function pinProfileFirstInFeed(
  profiles: Profile[],
  pool: Profile[],
  pinnedId: string | null | undefined,
  maxSize: number = HOURLY_FEED_SIZE,
): Profile[] {
  const id = pinnedId?.trim();
  if (!id || profiles.length === 0) return profiles;

  const inFeed = profiles.find((p) => p.id === id);
  const fromPool = pool.find((p) => p.id === id);
  const picked = inFeed ?? fromPool;
  if (!picked) return profiles;

  const rest = profiles.filter((p) => p.id !== id);
  return [picked, ...rest].slice(0, Math.max(1, maxSize));
}
