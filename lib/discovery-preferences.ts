/**
 * Discovery feed personalization shape (stored in Supabase `user_profiles.discovery_prefs`).
 */

/** @deprecated Legacy localStorage key — cleared on logout. */
export const DISCOVERY_PREFS_STORAGE_KEY = "whisper_discovery_prefs_v1";

export type ConnectWith = "everyone" | "men" | "women";

export type ChatEnergy = "calm" | "playful" | "both";

export type DatingIntent = "serious" | "casual" | "friends" | "open";

export type DiscoveryPreferencesV1 = {
  version: 1;
  connectWith: ConnectWith;
  ageMin: number;
  ageMax: number;
  chatEnergy: ChatEnergy;
  /** Max. 5 labels (Nederlands), zelfde woorden als in interesse-chips waar mogelijk */
  interestPicks: string[];
  datingIntent: DatingIntent;
};

export const DEFAULT_DISCOVERY_PREFS: DiscoveryPreferencesV1 = {
  version: 1,
  connectWith: "everyone",
  ageMin: 18,
  ageMax: 80,
  chatEnergy: "both",
  interestPicks: [],
  datingIntent: "open",
};

/** Snelle multi-select chips in de funnel (overlap met profiel-interesses). */
export const FUNNEL_INTEREST_OPTIONS: string[] = [
  "Koffie",
  "Muziek",
  "Films",
  "Koken",
  "Lezen",
  "Reizen",
  "Diepe gesprekken",
  "Luchtige humor",
  "Sportschool",
  "Kunst",
  "Romantisch",
  "Speels",
];

/** @deprecated Use `getDiscoveryPreferencesSnapshot` from discovery-preferences-store. */
export function loadDiscoveryPreferences(): DiscoveryPreferencesV1 | null {
  return null;
}

/** @deprecated Use `saveDiscoveryPreferencesToServer`. */
export function saveDiscoveryPreferences(_prefs: DiscoveryPreferencesV1): void {
  /* no-op — Supabase is source of truth */
}

export function clearLegacyDiscoveryPreferencesStorage(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DISCOVERY_PREFS_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
