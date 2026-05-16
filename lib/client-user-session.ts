/**
 * Clear or re-bind browser-local caches when the Supabase user changes.
 *
 * Without this, logging out / signing up as a new account in the same
 * browser leaks the previous user's inbox previews (whisper_thread_previews)
 * and credits balance (whisper_credits_active_user) into the next session.
 */

import {
  initCreditsStore,
  resetCreditsToGuest,
  resetCreditsForNewUser,
} from "@/lib/credits-store";
import {
  clearAllThreadPreviewStorage,
  switchThreadPreviewsUser,
} from "@/lib/thread-preview-store";

const LEGACY_CREDITS_KEY = "whisper_credits";

/** Call after sign-out so the next visitor starts clean. */
export function clearClientCachesOnLogout(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LEGACY_CREDITS_KEY);
  } catch {
    /* ignore */
  }
  clearAllThreadPreviewStorage();
  switchThreadPreviewsUser("guest");
  resetCreditsToGuest();
}

/**
 * Call after login or signup once we know the Supabase user id.
 * Re-binds per-user caches and pulls credits from the server.
 */
export function hydrateClientSessionForUser(userId: string): void {
  if (typeof window === "undefined") return;
  if (!userId) return;
  switchThreadPreviewsUser(userId);
  initCreditsStore();
}

/** Funnel signup: wipe cross-account leftovers, then seed this user. */
export function prepareNewAccountClientSession(
  userId: string,
  startingCredits: number,
): void {
  if (typeof window === "undefined") return;
  clearAllThreadPreviewStorage();
  try {
    localStorage.removeItem(LEGACY_CREDITS_KEY);
  } catch {
    /* ignore */
  }
  switchThreadPreviewsUser(userId);
  resetCreditsForNewUser(userId, startingCredits);
}

/** Resolve the current user id from the credits API (cheap, already exists). */
export async function fetchAuthenticatedUserId(): Promise<string | null> {
  try {
    const res = await fetch("/api/me/credits", { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      ok?: boolean;
      userId?: string;
      anonymous?: boolean;
    };
    if (!json.ok || json.anonymous || !json.userId) return null;
    return json.userId;
  } catch {
    return null;
  }
}

/** Login / auth callback: switch caches to whoever is signed in now. */
export async function hydrateClientSessionFromServer(): Promise<void> {
  const userId = await fetchAuthenticatedUserId();
  if (userId) {
    hydrateClientSessionForUser(userId);
  } else {
    clearClientCachesOnLogout();
  }
}
