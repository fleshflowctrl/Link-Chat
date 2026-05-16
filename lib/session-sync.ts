/**
 * Cross-device session sync — refetch Supabase-backed state when the tab
 * regains focus or the user returns to the app.
 */

import { refreshCreditsFromServer } from "@/lib/credits-store";

export const WHISPER_THREADS_REFETCH = "whisper:threads-refetch";
export const WHISPER_UNLOCKS_REFETCH = "whisper:unlocks-refetch";

export function requestThreadsRefetch(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(WHISPER_THREADS_REFETCH));
}

export function requestUnlocksRefetch(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(WHISPER_UNLOCKS_REFETCH));
}

/** Credits + inbox + unlocks — call after login or on visibility. */
export async function refreshSessionFromServer(): Promise<void> {
  await refreshCreditsFromServer();
  requestThreadsRefetch();
  requestUnlocksRefetch();
}
