"use client";

import type { DiscoveryPreferencesV1 } from "@/lib/discovery-preferences";
import { parseDiscoveryPreferencesJson } from "@/lib/discovery-preferences-server";

type Snapshot = {
  version: number;
  prefs: DiscoveryPreferencesV1 | null;
  loaded: boolean;
};

let snapshot: Snapshot = { version: 0, prefs: null, loaded: false };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function setPrefs(prefs: DiscoveryPreferencesV1 | null, loaded: boolean) {
  snapshot = { version: snapshot.version + 1, prefs, loaded };
  emit();
}

export function subscribeDiscoveryPreferences(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getDiscoveryPreferencesSnapshot(): DiscoveryPreferencesV1 | null {
  return snapshot.prefs;
}

export function discoveryPreferencesLoaded(): boolean {
  return snapshot.loaded;
}

export function resetDiscoveryPreferencesStore(): void {
  setPrefs(null, false);
}

/** Apply prefs locally (instant grid re-sort; guests or optimistic UI). */
export function setDiscoveryPreferencesClient(prefs: DiscoveryPreferencesV1): void {
  setPrefs(prefs, true);
}

/** Pull discovery prefs from Supabase. */
export async function refreshDiscoveryPreferencesFromServer(): Promise<void> {
  try {
    const res = await fetch("/api/me/discovery-preferences", {
      cache: "no-store",
    });
    if (!res.ok) {
      setPrefs(null, true);
      return;
    }
    const json = (await res.json()) as {
      ok?: boolean;
      prefs?: unknown;
      anonymous?: boolean;
    };
    if (!json.ok || json.anonymous) {
      setPrefs(null, true);
      return;
    }
    const parsed = parseDiscoveryPreferencesJson(json.prefs);
    setPrefs(parsed, true);
  } catch {
    setPrefs(null, true);
  }
}

export async function saveDiscoveryPreferencesToServer(
  prefs: DiscoveryPreferencesV1,
): Promise<boolean> {
  try {
    const res = await fetch("/api/me/discovery-preferences", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(prefs),
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { ok?: boolean; prefs?: unknown };
    const parsed = parseDiscoveryPreferencesJson(json.prefs);
    if (parsed) setPrefs(parsed, true);
    return Boolean(json.ok);
  } catch {
    return false;
  }
}
