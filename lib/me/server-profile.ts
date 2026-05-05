import { redirect } from "next/navigation";
import { meProfile } from "@/data/me";
import {
  createDefaultEditableForNewUser,
  createInitialEditable,
  type EditProfilePreferences,
  type EditProfileState,
  type GalleryPhoto,
  type PronounsValue,
  PRONOUN_OPTIONS,
} from "@/data/me-edit";
import { hasServerDevBypassCookie } from "@/lib/dev-bypass-server";
import { createClient } from "@/utils/supabase/server";
import { isSupabaseConfigured } from "@/utils/supabase/public-env";

export type UserProfileRow = {
  user_id: string;
  first_name: string;
  age: number;
  location: string;
  pronouns: string;
  custom_pronouns: string;
  bio: string;
  looking_for: string;
  interests: string[] | null;
  main_photo_url: string;
  gallery: unknown;
  preferences: unknown;
  updated_at: string;
  credits?: number | null;
};

const DEFAULT_PREFS: EditProfilePreferences = {
  showDistance: true,
  showOnlineStatus: true,
  allowNewChatRequests: true,
  pushNotifications: true,
};

export function formatProfileLastUpdatedLabel(
  iso: string | null | undefined,
): string {
  if (!iso) return "Not saved yet";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Not saved yet";
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return "Updated today";
  if (days === 1) return "Updated yesterday";
  return `Updated ${days} days ago`;
}

function parsePronouns(raw: string): PronounsValue {
  if (PRONOUN_OPTIONS.includes(raw as PronounsValue)) {
    return raw as PronounsValue;
  }
  return "they/them";
}

function parseGallery(raw: unknown): GalleryPhoto[] {
  if (!Array.isArray(raw)) return [];
  const out: GalleryPhoto[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const id = (item as { id?: unknown }).id;
    const url = (item as { url?: unknown }).url;
    if (typeof id !== "string" || typeof url !== "string") continue;
    out.push({ id, url });
  }
  return out;
}

function parsePreferences(raw: unknown): EditProfilePreferences {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PREFS };
  const o = raw as Record<string, unknown>;
  return {
    showDistance: Boolean(o.showDistance ?? DEFAULT_PREFS.showDistance),
    showOnlineStatus: Boolean(
      o.showOnlineStatus ?? DEFAULT_PREFS.showOnlineStatus,
    ),
    allowNewChatRequests: Boolean(
      o.allowNewChatRequests ?? DEFAULT_PREFS.allowNewChatRequests,
    ),
    pushNotifications: Boolean(
      o.pushNotifications ?? DEFAULT_PREFS.pushNotifications,
    ),
  };
}

export function userProfileRowToEditState(row: UserProfileRow): EditProfileState {
  const interests = Array.isArray(row.interests) ? row.interests : [];
  const fallbackPhoto = createDefaultEditableForNewUser().mainPhotoUrl;

  return {
    firstName: row.first_name ?? "",
    age:
      typeof row.age === "number" && row.age >= 18 && row.age <= 120
        ? row.age
        : 25,
    location: row.location ?? "",
    pronouns: parsePronouns(row.pronouns ?? "they/them"),
    customPronouns: row.custom_pronouns ?? "",
    bio: row.bio ?? "",
    lookingFor: row.looking_for ?? "",
    interests,
    mainPhotoUrl: row.main_photo_url?.trim() || fallbackPhoto,
    gallery: parseGallery(row.gallery),
    preferences: parsePreferences(row.preferences),
    lastUpdatedLabel: formatProfileLastUpdatedLabel(row.updated_at),
  };
}

export function editStateToUserProfileUpsert(
  userId: string,
  state: EditProfileState,
): UserProfileRow {
  return {
    user_id: userId,
    first_name: state.firstName.trim(),
    age: Math.min(120, Math.max(18, Math.round(state.age))),
    location: state.location.trim(),
    pronouns: state.pronouns,
    custom_pronouns: state.customPronouns.trim(),
    bio: state.bio,
    looking_for: state.lookingFor.trim(),
    interests: state.interests,
    main_photo_url: state.mainPhotoUrl,
    gallery: state.gallery,
    preferences: state.preferences,
    updated_at: new Date().toISOString(),
  };
}

function defaultCredits(): number {
  return meProfile.stats.credits.value;
}

export async function fetchUserCreditsServer(): Promise<number> {
  if (hasServerDevBypassCookie() || !isSupabaseConfigured()) {
    return defaultCredits();
  }

  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return defaultCredits();

    const { data: row } = await supabase
      .from("user_profiles")
      .select("credits")
      .eq("user_id", user.id)
      .maybeSingle();

    const c = row?.credits;
    return typeof c === "number" && c >= 0 ? c : defaultCredits();
  } catch {
    return defaultCredits();
  }
}

export async function fetchUserEditProfileServer(): Promise<{
  profile: EditProfileState;
  /** Pass to client as effect dependency when hydrating the in-memory store. */
  syncToken: string;
  credits: number;
}> {
  if (hasServerDevBypassCookie() || !isSupabaseConfigured()) {
    const profile = createInitialEditable();
    return { profile, syncToken: "mock", credits: defaultCredits() };
  }

  let supabase: ReturnType<typeof createClient>;
  try {
    supabase = createClient();
  } catch {
    const profile = createInitialEditable();
    return { profile, syncToken: "mock", credits: defaultCredits() };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: row, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[fetchUserEditProfileServer]", error);
    const profile = createDefaultEditableForNewUser();
    return { profile, syncToken: "error", credits: defaultCredits() };
  }

  if (!row) {
    const profile = createDefaultEditableForNewUser();
    return { profile, syncToken: "no-row", credits: defaultCredits() };
  }

  const r = row as UserProfileRow;
  const profile = userProfileRowToEditState(r);
  const updated = r.updated_at;
  const credits =
    typeof r.credits === "number" && r.credits >= 0 ? r.credits : defaultCredits();
  return { profile, syncToken: updated ?? "unknown", credits };
}
