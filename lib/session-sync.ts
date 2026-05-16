/**
 * Cross-device session sync — refetch Supabase-backed state when the tab
 * regains focus or the user returns to the app.
 */

import { refreshCreditsFromServer } from "@/lib/credits-store";
import { refreshDiscoveryPreferencesFromServer } from "@/lib/discovery-preferences-store";
import { syncPendingFunnelProfileIfNeeded } from "@/lib/funnel/sync-pending-profile";

export const WHISPER_THREADS_REFETCH = "whisper:threads-refetch";
export const WHISPER_UNLOCKS_REFETCH = "whisper:unlocks-refetch";
export const WHISPER_DISCOVERY_PREFS_REFETCH = "whisper:discovery-prefs-refetch";

export function requestThreadsRefetch(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(WHISPER_THREADS_REFETCH));
}

export function requestUnlocksRefetch(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(WHISPER_UNLOCKS_REFETCH));
}

export function requestDiscoveryPrefsRefetch(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(WHISPER_DISCOVERY_PREFS_REFETCH));
}

/** Credits + inbox + unlocks + discovery — call after login or on visibility. */
export async function refreshSessionFromServer(): Promise<void> {
  await syncPendingFunnelProfileIfNeeded();
  await refreshCreditsFromServer();
  await refreshDiscoveryPreferencesFromServer();
  requestThreadsRefetch();
  requestUnlocksRefetch();
  requestDiscoveryPrefsRefetch();
}
