import type { Profile } from "@/data/profiles";
import type { ChatProfileRow } from "@/lib/chat/map-rows";
import { chatProfileRowToProfile } from "@/lib/catalog/chat-profile-to-profile";
import {
  applyChatProfilesVariantFilter,
  staticCatalogProfiles,
} from "@/lib/catalog/profile-variant";
import type { AppVariant } from "@/lib/app-variant";
import { getServiceSupabase } from "@/lib/supabase/admin";

/** Load discover pool server-side without an auth session (SSR for first visit). */
export async function fetchDiscoverPoolServer(
  variant: AppVariant,
): Promise<{ pool: Profile[]; degraded: boolean }> {
  const fallback = staticCatalogProfiles(variant);
  const admin = getServiceSupabase();
  if (!admin) {
    return { pool: fallback, degraded: fallback.length === 0 };
  }

  let query = admin
    .from("chat_profiles")
    .select("*")
    .order("home_sort", { ascending: true })
    .order("display_name", { ascending: true })
    .limit(120);
  query = applyChatProfilesVariantFilter(query, variant);
  const { data: rows, error } = await query;

  if (error || !rows?.length) {
    if (error) console.error("[fetchDiscoverPoolServer]", error);
    return { pool: fallback, degraded: true };
  }

  return {
    pool: (rows as ChatProfileRow[]).map(chatProfileRowToProfile),
    degraded: false,
  };
}
