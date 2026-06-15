import type { Profile } from "@/data/profiles";
import type { ChatProfileRow } from "@/lib/chat/map-rows";
import { chatProfileRowToProfile } from "@/lib/catalog/chat-profile-to-profile";
import {
  applyChatProfilesVariantFilter,
  staticCatalogProfiles,
} from "@/lib/catalog/profile-variant";
import type { AppVariant } from "@/lib/app-variant";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { isSupabaseConfigured } from "@/utils/supabase/public-env";

async function queryDiscoverPoolRows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: { from: (table: string) => any },
  variant: AppVariant,
  aiOnly: boolean,
): Promise<{ rows: ChatProfileRow[] | null; error: unknown }> {
  let query = client
    .from("chat_profiles")
    .select("*")
    .order("home_sort", { ascending: true })
    .order("display_name", { ascending: true })
    .limit(120);
  if (aiOnly) {
    query = query.eq("is_ai", true);
  }
  query = applyChatProfilesVariantFilter(query, variant);
  const { data, error } = await query;
  return { rows: (data as ChatProfileRow[] | null) ?? null, error };
}

/** Load discover pool server-side without an auth session (SSR for first visit). */
export async function fetchDiscoverPoolServer(
  variant: AppVariant,
): Promise<{ pool: Profile[]; degraded: boolean }> {
  const fallback = staticCatalogProfiles(variant);

  const admin = getServiceSupabase();
  if (admin) {
    const { rows, error } = await queryDiscoverPoolRows(admin, variant, true);
    if (!error && rows?.length) {
      return {
        pool: rows.map(chatProfileRowToProfile),
        degraded: false,
      };
    }
    if (error) console.error("[fetchDiscoverPoolServer] admin", error);
  }

  // Production often has anon keys but no service role on the edge runtime.
  // RLS allows anon SELECT on AI personas (`chat_profiles_select_anon_ai`).
  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      const { rows, error } = await queryDiscoverPoolRows(supabase, variant, true);
      if (!error && rows?.length) {
        return {
          pool: rows.map(chatProfileRowToProfile),
          degraded: false,
        };
      }
      if (error) console.error("[fetchDiscoverPoolServer] anon", error);
    } catch (err) {
      console.error("[fetchDiscoverPoolServer] anon client", err);
    }
  }

  return { pool: fallback, degraded: true };
}
