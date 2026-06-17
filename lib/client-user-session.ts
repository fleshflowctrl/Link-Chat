/**
 * Re-bind in-memory client state when the Supabase user changes.
 * All durable data lives in Supabase — nothing is written to localStorage.
 */

import {
  initCreditsStore,
  refreshCreditsFromServer,
  resetCreditsToGuest,
} from "@/lib/credits-store";
import { clearLegacyDiscoveryPreferencesStorage } from "@/lib/discovery-preferences";
import { resetDiscoveryPreferencesStore } from "@/lib/discovery-preferences-store";
import { clearFunnelPendingProfile } from "@/lib/funnel/pending-profile";
import { refreshSessionFromServer } from "@/lib/session-sync";
import { clearInboxThreadsCache } from "@/lib/inbox-threads-cache";
import { clearThreadPreviews } from "@/lib/thread-preview-store";

export function clearClientCachesOnLogout(): void {
  clearInboxThreadsCache();
  clearThreadPreviews();
  resetCreditsToGuest();
  resetDiscoveryPreferencesStore();
  clearLegacyDiscoveryPreferencesStorage();
  clearFunnelPendingProfile();
  clearLegacyFunnelLocalStorage();
}

/** Remove deprecated funnel keys (data now lives in Supabase). */
export function clearLegacyFunnelLocalStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem("whisper_onboarded");
    window.localStorage.removeItem("whisper_user");
  } catch {
    /* ignore */
  }
}

export function hydrateClientSessionForUser(_userId: string): void {
  clearThreadPreviews();
  void refreshSessionFromServer();
}

export function prepareNewAccountClientSession(
  _userId: string,
  _startingCredits: number,
) {
  clearThreadPreviews();
  void refreshCreditsFromServer();
}

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

export async function hydrateClientSessionFromServer(): Promise<void> {
  const userId = await fetchAuthenticatedUserId();
  if (userId) {
    hydrateClientSessionForUser(userId);
    return;
  }
  // Session may still be hydrating — don't wipe client state on a transient miss.
  void refreshCreditsFromServer();
}

/** @deprecated Use hydrateClientSessionForUser */
export function initCreditsStoreOnLogin(): void {
  initCreditsStore();
}
