import type {
  ChatEnergy,
  ConnectWith,
  DatingIntent,
  DiscoveryPreferencesV1,
} from "@/lib/discovery-preferences";
import { DEFAULT_DISCOVERY_PREFS } from "@/lib/discovery-preferences";

export type UserProfileDiscoverySource = {
  discovery_prefs?: unknown;
  gender?: string | null;
  seeking_gender?: string | null;
  age_range_min?: number | null;
  age_range_max?: number | null;
  age_range_any?: boolean | null;
  looking_for?: string | null;
  interests?: string[] | null;
};

function isConnectWith(v: unknown): v is ConnectWith {
  return v === "everyone" || v === "men" || v === "women";
}

function isChatEnergy(v: unknown): v is ChatEnergy {
  return v === "calm" || v === "playful" || v === "both";
}

function isDatingIntent(v: unknown): v is DatingIntent {
  return (
    v === "serious" ||
    v === "casual" ||
    v === "friends" ||
    v === "open"
  );
}

export function parseDiscoveryPreferencesJson(
  raw: unknown,
): DiscoveryPreferencesV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return null;
  return {
    version: 1,
    connectWith: isConnectWith(o.connectWith)
      ? o.connectWith
      : DEFAULT_DISCOVERY_PREFS.connectWith,
    ageMin:
      typeof o.ageMin === "number" && o.ageMin >= 18 && o.ageMin <= 99
        ? o.ageMin
        : DEFAULT_DISCOVERY_PREFS.ageMin,
    ageMax:
      typeof o.ageMax === "number" && o.ageMax >= 18 && o.ageMax <= 99
        ? o.ageMax
        : DEFAULT_DISCOVERY_PREFS.ageMax,
    chatEnergy: isChatEnergy(o.chatEnergy)
      ? o.chatEnergy
      : DEFAULT_DISCOVERY_PREFS.chatEnergy,
    interestPicks: Array.isArray(o.interestPicks)
      ? o.interestPicks.filter((x) => typeof x === "string").slice(0, 8)
      : [],
    datingIntent: isDatingIntent(o.datingIntent)
      ? o.datingIntent
      : DEFAULT_DISCOVERY_PREFS.datingIntent,
  };
}

export function discoveryPrefsToJson(
  prefs: DiscoveryPreferencesV1,
): Record<string, unknown> {
  return {
    version: 1,
    connectWith: prefs.connectWith,
    ageMin: prefs.ageMin,
    ageMax: prefs.ageMax,
    chatEnergy: prefs.chatEnergy,
    interestPicks: prefs.interestPicks.slice(0, 8),
    datingIntent: prefs.datingIntent,
  };
}

function seekingGenderToConnectWith(seeking: string): ConnectWith {
  if (seeking === "men") return "men";
  if (seeking === "women") return "women";
  return "everyone";
}

function lookingForToDatingIntent(lookingFor: string): DatingIntent {
  switch (lookingFor) {
    case "meaningful":
      return "serious";
    case "casual":
    case "chatting":
      return "casual";
    case "friends":
      return "friends";
    default:
      return "open";
  }
}

/** Build prefs from stored JSON or funnel demographics on `user_profiles`. */
export function resolveDiscoveryPreferences(
  row: UserProfileDiscoverySource | null | undefined,
): DiscoveryPreferencesV1 {
  const stored = parseDiscoveryPreferencesJson(row?.discovery_prefs);
  if (stored) return stored;

  if (!row) return { ...DEFAULT_DISCOVERY_PREFS };

  const anyAge = Boolean(row.age_range_any);
  const ageMin =
    typeof row.age_range_min === "number" ? row.age_range_min : 18;
  const ageMax =
    typeof row.age_range_max === "number" ? row.age_range_max : 35;

  return {
    version: 1,
    connectWith: seekingGenderToConnectWith(row.seeking_gender ?? ""),
    ageMin: anyAge ? 18 : ageMin,
    ageMax: anyAge ? 80 : ageMax,
    chatEnergy: "both",
    interestPicks: Array.isArray(row.interests)
      ? row.interests.filter((x) => typeof x === "string").slice(0, 8)
      : [],
    datingIntent: lookingForToDatingIntent(row.looking_for ?? ""),
  };
}

export function funnelInputToDiscoveryPrefs(input: {
  lookingFor: string | null;
  seekingGender: string | null;
  ageRange: { min: number; max: number; anyAge: boolean };
  interestPicks?: string[];
}): DiscoveryPreferencesV1 {
  const anyAge = input.ageRange.anyAge;
  return {
    version: 1,
    connectWith: seekingGenderToConnectWith(input.seekingGender ?? ""),
    ageMin: anyAge ? 18 : input.ageRange.min,
    ageMax: anyAge ? 80 : input.ageRange.max,
    chatEnergy: "both",
    interestPicks: (input.interestPicks ?? []).slice(0, 8),
    datingIntent: lookingForToDatingIntent(input.lookingFor ?? ""),
  };
}
