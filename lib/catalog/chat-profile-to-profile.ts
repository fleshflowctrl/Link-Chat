import type {
  Profile,
  ProfileInterest,
  ProfileInterestIcon,
  ProfileStatusVariant,
} from "@/data/profiles";
import type { ChatProfileRow } from "@/lib/chat/map-rows";
import { normalizeFunnelIntentIds } from "@/lib/catalog/normalize-funnel-intent-ids";
import { normalizeFunnelVibeTags } from "@/lib/catalog/normalize-funnel-vibe-tags";

const STATUS_VARIANTS = new Set<ProfileStatusVariant>([
  "active",
  "replied",
  "new",
  "popular",
  "quiet",
  "online",
]);

const INTEREST_ICONS = new Set<ProfileInterestIcon>([
  "caring",
  "romantic",
  "playful",
  "warm",
  "listener",
]);

function parseStatusVariant(raw: string | null | undefined): ProfileStatusVariant {
  if (raw && STATUS_VARIANTS.has(raw as ProfileStatusVariant)) {
    return raw as ProfileStatusVariant;
  }
  return "active";
}

/** Maps interest pill icons to `FUNNEL_VIBES` ids (warm/listener are UI-only). */
const ICON_TO_VIBE: Record<ProfileInterestIcon, string> = {
  caring: "caring",
  romantic: "romantic",
  playful: "playful",
  warm: "chill",
  listener: "caring",
};

function vibesFromInterests(interests: ProfileInterest[]): string[] {
  const ids = interests.map((i) => ICON_TO_VIBE[i.icon]).filter(Boolean);
  const raw = ids.length ? ids : (["chill", "playful"] as const);
  return Array.from(new Set(raw));
}

function parseInterests(raw: unknown): ProfileInterest[] {
  if (!Array.isArray(raw)) return [];
  const out: ProfileInterest[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const label = (item as { label?: unknown }).label;
    const icon = (item as { icon?: unknown }).icon;
    if (typeof label !== "string" || !label.trim()) continue;
    const ic =
      typeof icon === "string" && INTEREST_ICONS.has(icon as ProfileInterestIcon)
        ? (icon as ProfileInterestIcon)
        : "listener";
    out.push({ label: label.trim(), icon: ic });
  }
  return out.length ? out : [{ label: "Friendly", icon: "warm" }];
}

/** Profile page gallery: profielfoto first, then extra shots (no duplicates). */
function galleryForRow(row: ChatProfileRow): string[] {
  const hero =
    typeof row.avatar_url === "string" && row.avatar_url.trim()
      ? row.avatar_url.trim()
      : "";
  const extras =
    row.gallery_urls?.filter(
      (u): u is string => typeof u === "string" && u.length > 0,
    ) ?? [];

  const seen = new Set<string>();
  const out: string[] = [];
  if (hero) {
    out.push(hero);
    seen.add(hero);
  }
  for (const url of extras) {
    if (!seen.has(url)) {
      out.push(url);
      seen.add(url);
    }
  }
  return out;
}

/**
 * Map a catalog (`chat_profiles`) row to the discovery `Profile` shape used by the UI.
 */
export function chatProfileRowToProfile(row: ChatProfileRow): Profile {
  const variant = parseStatusVariant(row.status_variant);
  const rawLabel =
    typeof row.status_label === "string" && row.status_label.trim()
      ? row.status_label.trim()
      : "";
  const isPresenceStatus = variant === "online" || variant === "active";
  const status: Profile["status"] = {
    variant: isPresenceStatus ? "quiet" : variant,
    label: isPresenceStatus ? "" : rawLabel,
  };

  const interests = parseInterests(row.interests);
  const fromDb = (row.vibe_tags ?? []).filter(
    (t): t is string => typeof t === "string" && t.trim().length > 0,
  );
  const vibe =
    fromDb.length > 0
      ? normalizeFunnelVibeTags(fromDb)
      : normalizeFunnelVibeTags(vibesFromInterests(interests));
  const funnelIntentIds = normalizeFunnelIntentIds(row.funnel_intent_ids);

  return {
    id: row.id,
    name: row.display_name,
    age: typeof row.age === "number" && row.age > 0 ? row.age : 25,
    photo: row.avatar_url,
    city:
      typeof row.city === "string" && row.city.trim()
        ? row.city.trim()
        : "Amsterdam",
    status,
    bio: row.bio ?? "",
    gallery: galleryForRow(row),
    interests,
    vibe,
    ...(funnelIntentIds.length ? { funnelIntentIds } : {}),
    distanceKm: 2.5,
    topEmojis: ["✨", "✨"],
    lookingFor:
      typeof row.looking_for === "string" && row.looking_for.trim()
        ? row.looking_for.trim()
        : "Good conversations",
    lastActive:
      typeof row.last_active_label === "string" && row.last_active_label.trim()
        ? row.last_active_label.trim()
        : "Active today",
    isVerified: !!row.verified,
  };
}
