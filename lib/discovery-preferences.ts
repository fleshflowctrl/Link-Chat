/**
 * Optionele discovery-voorkeuren in localStorage (bijv. later via instellingen);
 * dezelfde shape kan naar Supabase gesynchroniseerd worden.
 */

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

export function loadDiscoveryPreferences(): DiscoveryPreferencesV1 | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DISCOVERY_PREFS_STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<DiscoveryPreferencesV1>;
    if (o.version !== 1) return null;
    return {
      version: 1,
      connectWith:
        o.connectWith === "men" || o.connectWith === "women"
          ? o.connectWith
          : "everyone",
      ageMin:
        typeof o.ageMin === "number" && o.ageMin >= 18 && o.ageMin <= 80
          ? o.ageMin
          : DEFAULT_DISCOVERY_PREFS.ageMin,
      ageMax:
        typeof o.ageMax === "number" && o.ageMax >= 18 && o.ageMax <= 80
          ? o.ageMax
          : DEFAULT_DISCOVERY_PREFS.ageMax,
      chatEnergy:
        o.chatEnergy === "calm" || o.chatEnergy === "playful" || o.chatEnergy === "both"
          ? o.chatEnergy
          : "both",
      interestPicks: Array.isArray(o.interestPicks)
        ? o.interestPicks.filter((x) => typeof x === "string").slice(0, 8)
        : [],
      datingIntent:
        o.datingIntent === "serious" ||
        o.datingIntent === "casual" ||
        o.datingIntent === "friends" ||
        o.datingIntent === "open"
          ? o.datingIntent
          : "open",
    };
  } catch {
    return null;
  }
}

export function saveDiscoveryPreferences(prefs: DiscoveryPreferencesV1): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DISCOVERY_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* quota / private mode */
  }
}
