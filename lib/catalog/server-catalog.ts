import { redirect } from "next/navigation";
import {
  getProfileById,
  homeGridProfiles,
  profiles,
  type Profile,
} from "@/data/profiles";
import type { NewWhisperUser } from "@/data/newUsers";
import type { ChatProfileRow } from "@/lib/chat/map-rows";
import { chatProfileRowToProfile } from "@/lib/catalog/chat-profile-to-profile";
import { hasServerDevBypassCookie } from "@/lib/dev-bypass-server";
import { createClient } from "@/utils/supabase/server";
import { isSupabaseConfigured } from "@/utils/supabase/public-env";

export type HomePageCatalogBundle = {
  gridProfiles: Profile[];
  activityUsers: NewWhisperUser[];
  /** True when Supabase was expected but the home grid fell back to static demo data. */
  catalogDegraded: boolean;
};

export async function fetchHomePageCatalogServer(): Promise<HomePageCatalogBundle> {
  if (hasServerDevBypassCookie() || !isSupabaseConfigured()) {
    const { getNewWhisperUsers } = await import("@/data/newUsers");
    return {
      gridProfiles: homeGridProfiles,
      activityUsers: getNewWhisperUsers(),
      catalogDegraded: false,
    };
  }

  let supabase: ReturnType<typeof createClient>;
  try {
    supabase = createClient();
  } catch {
    const { getNewWhisperUsers } = await import("@/data/newUsers");
    return {
      gridProfiles: homeGridProfiles,
      activityUsers: getNewWhisperUsers(),
      catalogDegraded: true,
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const { getNewWhisperUsers } = await import("@/data/newUsers");
    return {
      gridProfiles: homeGridProfiles,
      activityUsers: getNewWhisperUsers(),
      catalogDegraded: false,
    };
  }

  const { data: rows, error: gridError } = await supabase
    .from("chat_profiles")
    .select("*")
    .order("home_sort", { ascending: true })
    .order("display_name", { ascending: true })
    .limit(6);

  let gridProfiles: Profile[];
  let gridDegraded = false;
  if (gridError || !rows?.length) {
    console.error("[fetchHomePageCatalogServer] grid", gridError);
    gridProfiles = homeGridProfiles;
    gridDegraded = true;
  } else {
    gridProfiles = (rows as ChatProfileRow[]).map(chatProfileRowToProfile);
  }

  const { data: actRows, error: actError } = await supabase
    .from("chat_profiles")
    .select("id, display_name, avatar_url, joined_at")
    .not("joined_at", "is", null)
    .order("joined_at", { ascending: false })
    .limit(12);

  let activityUsers: NewWhisperUser[];
  if (actError || !actRows?.length) {
    const { getNewWhisperUsers } = await import("@/data/newUsers");
    activityUsers = getNewWhisperUsers();
  } else {
    activityUsers = actRows
      .filter((r) => r.joined_at && r.id && r.display_name && r.avatar_url)
      .map((r) => ({
        id: r.id as string,
        name: r.display_name as string,
        avatar: r.avatar_url as string,
        joinedMinutesAgo: 0,
        joinedAt: r.joined_at as string,
      }));
  }

  return {
    gridProfiles,
    activityUsers,
    catalogDegraded: gridDegraded,
  };
}

/**
 * Full AI catalog for onboarding step 6 (vibe + age + intent matching).
 * Uses anon session when not signed in; RLS allows `SELECT` on `is_ai` rows only.
 */
export async function fetchFunnelCatalogProfilesServer(): Promise<{
  profiles: Profile[];
  catalogDegraded: boolean;
}> {
  if (hasServerDevBypassCookie() || !isSupabaseConfigured()) {
    return { profiles, catalogDegraded: false };
  }

  let supabase: ReturnType<typeof createClient>;
  try {
    supabase = createClient();
  } catch {
    return { profiles, catalogDegraded: true };
  }

  const { data: rows, error } = await supabase
    .from("chat_profiles")
    .select("*")
    .eq("is_ai", true)
    .order("home_sort", { ascending: true })
    .order("display_name", { ascending: true })
    .limit(250);

  if (error || !rows?.length) {
    if (error) console.error("[fetchFunnelCatalogProfilesServer]", error.message);
    return { profiles, catalogDegraded: true };
  }

  return {
    profiles: (rows as ChatProfileRow[]).map(chatProfileRowToProfile),
    catalogDegraded: false,
  };
}

export async function fetchHomeGridProfilesServer(): Promise<Profile[]> {
  const { gridProfiles } = await fetchHomePageCatalogServer();
  return gridProfiles;
}

export async function fetchCatalogProfileByIdServer(
  id: string,
): Promise<Profile | null> {
  if (hasServerDevBypassCookie() || !isSupabaseConfigured()) {
    return getProfileById(id) ?? null;
  }

  let supabase: ReturnType<typeof createClient>;
  try {
    supabase = createClient();
  } catch {
    return getProfileById(id) ?? null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: row, error } = await supabase
    .from("chat_profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !row) {
    return getProfileById(id) ?? null;
  }

  return chatProfileRowToProfile(row as ChatProfileRow);
}

export async function fetchActivityStripUsersServer(): Promise<NewWhisperUser[]> {
  const { activityUsers } = await fetchHomePageCatalogServer();
  return activityUsers;
}
