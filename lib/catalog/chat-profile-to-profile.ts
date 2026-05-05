import type {
  Profile,
  ProfileInterest,
  ProfileInterestIcon,
  ProfileStatusVariant,
} from "@/data/profiles";
import type { ChatProfileRow } from "@/lib/chat/map-rows";

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

function galleryForRow(row: ChatProfileRow): string[] {
  const urls = row.gallery_urls?.filter(
    (u): u is string => typeof u === "string" && u.length > 0,
  );
  if (urls?.length) return urls;
  const hero = row.avatar_url;
  return Array.from({ length: 6 }, () => hero);
}

/**
 * Map a catalog (`chat_profiles`) row to the discovery `Profile` shape used by the UI.
 */
export function chatProfileRowToProfile(row: ChatProfileRow): Profile {
  const status: Profile["status"] = {
    variant: parseStatusVariant(row.status_variant),
    label:
      typeof row.status_label === "string" && row.status_label.trim()
        ? row.status_label.trim()
        : "Active now",
  };

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
    interests: parseInterests(row.interests),
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
