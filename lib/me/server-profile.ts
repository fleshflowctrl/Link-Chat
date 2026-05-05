import { redirect } from "next/navigation";
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
  age: number | null;
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
  stat_chats?: number | null;
  stat_links?: number | null;
  stat_likes?: number | null;
};

const DEFAULT_PREFS: EditProfilePreferences = {
  showDistance: true,
  showOnlineStatus: true,
  allowNewChatRequests: true,
  pushNotifications: true,
};

const DEFAULT_CREDITS = 125;

export function formatProfileLastUpdatedLabel(
  iso: string | null | undefined,
): string {
  if (!iso) return "Nog niet opgeslagen";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Nog niet opgeslagen";
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return "Vandaag bijgewerkt";
  if (days === 1) return "Gisteren bijgewerkt";
  return `${days} dagen geleden bijgewerkt`;
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
  const ageVal = row.age;
  const age: number | null =
    ageVal === null || ageVal === undefined
      ? null
      : typeof ageVal === "number" && ageVal >= 18 && ageVal <= 120
        ? ageVal
        : null;

  return {
    firstName: row.first_name ?? "",
    age,
    location: row.location ?? "",
    pronouns: parsePronouns(row.pronouns ?? "they/them"),
    customPronouns: row.custom_pronouns ?? "",
    bio: row.bio ?? "",
    lookingFor: row.looking_for ?? "",
    interests,
    mainPhotoUrl: row.main_photo_url?.trim() ?? "",
    gallery: parseGallery(row.gallery),
    preferences: parsePreferences(row.preferences),
    lastUpdatedLabel: formatProfileLastUpdatedLabel(row.updated_at),
  };
}

export function editStateToUserProfileUpsert(
  userId: string,
  state: EditProfileState,
): UserProfileRow {
  const ageUpsert: number | null =
    state.age == null
      ? null
      : Math.min(120, Math.max(18, Math.round(state.age)));

  return {
    user_id: userId,
    first_name: state.firstName.trim(),
    age: ageUpsert,
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
  return DEFAULT_CREDITS;
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

export async function countDistinctChatPeersForUser(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("peer_id")
    .eq("owner_user_id", userId);

  if (error || !data?.length) return 0;
  return new Set(data.map((r) => r.peer_id as string)).size;
}

export type MeProfileStats = {
  chats: number;
  links: number;
  likes: number;
};

export async function fetchUserEditProfileServer(): Promise<{
  profile: EditProfileState;
  /** Pass to client as effect dependency when hydrating the in-memory store. */
  syncToken: string;
  credits: number;
  stats: MeProfileStats;
  /** Email confirmed at signup / confirmation flow. */
  showVerified: boolean;
}> {
  const emptyStats: MeProfileStats = { chats: 0, links: 0, likes: 0 };

  if (hasServerDevBypassCookie() || !isSupabaseConfigured()) {
    const profile = createInitialEditable();
    return {
      profile,
      syncToken: "mock",
      credits: defaultCredits(),
      stats: emptyStats,
      showVerified: false,
    };
  }

  let supabase: ReturnType<typeof createClient>;
  try {
    supabase = createClient();
  } catch {
    const profile = createInitialEditable();
    return {
      profile,
      syncToken: "mock",
      credits: defaultCredits(),
      stats: emptyStats,
      showVerified: false,
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const showVerified = Boolean(user.email_confirmed_at);
  const chatPeerCount = await countDistinctChatPeersForUser(supabase, user.id);

  const { data: row, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[fetchUserEditProfileServer]", error);
    const profile = createDefaultEditableForNewUser();
    return {
      profile,
      syncToken: "error",
      credits: defaultCredits(),
      stats: {
        chats: chatPeerCount,
        links: 0,
        likes: 0,
      },
      showVerified,
    };
  }

  if (!row) {
    const profile = createDefaultEditableForNewUser();
    return {
      profile,
      syncToken: "no-row",
      credits: defaultCredits(),
      stats: {
        chats: chatPeerCount,
        links: 0,
        likes: 0,
      },
      showVerified,
    };
  }

  const r = row as UserProfileRow;
  const profile = userProfileRowToEditState(r);
  const updated = r.updated_at;
  const credits =
    typeof r.credits === "number" && r.credits >= 0 ? r.credits : defaultCredits();
  const stats: MeProfileStats = {
    chats: chatPeerCount,
    links: typeof r.stat_links === "number" && r.stat_links >= 0 ? r.stat_links : 0,
    likes: typeof r.stat_likes === "number" && r.stat_likes >= 0 ? r.stat_likes : 0,
  };
  return {
    profile,
    syncToken: updated ?? "unknown",
    credits,
    stats,
    showVerified,
  };
}
