import { getProfileById, type Profile } from "@/data/profiles";
import type { NewWhisperUser } from "@/data/newUsers";
import type { ChatProfileRow } from "@/lib/chat/map-rows";
import { chatProfileRowToProfile } from "@/lib/catalog/chat-profile-to-profile";
import { applyDiscoverFeedStatusToProfiles } from "@/lib/catalog/discover-feed-status";
import { hasServerDevBypassCookie } from "@/lib/dev-bypass-server";
import {
  HOURLY_FEED_SIZE,
  activeFeedSlot,
  hashFeedComposition,
  hourlyFeedRefreshCostForVariant,
  nextHourBoundary,
  pickHourlyFeedWithHistory,
} from "@/lib/catalog/hourly-feed";
import {
  loadProfileViewHistory,
  type ProfileViewHistory,
} from "@/lib/me/profile-views";
import type { AppVariant } from "@/lib/app-variant";
import { DEFAULT_APP_VARIANT, readServerAppVariant } from "@/lib/app-variant";
import {
  applyChatProfilesVariantFilter,
  applyDiscoverPoolFilters,
  applyLiveDiscoverPoolFilter,
  chatProfileMatchesVariant,
  staticCatalogProfiles,
} from "@/lib/catalog/profile-variant";
import { pinProfileFirstInFeed } from "@/lib/catalog/funnel-picked-peer";
import { createClient } from "@/utils/supabase/server";
import { isSupabaseConfigured } from "@/utils/supabase/public-env";

export type CatalogVariantOptions = {
  /** Which bot pool to load. Defaults to v1 (unchanged behaviour). */
  variant?: AppVariant;
  /** Discover: mix live personas from v1 and v2 on one feed. */
  allLiveVariants?: boolean;
};

export type HomePageCatalogBundle = {
  gridProfiles: Profile[];
  activityUsers: NewWhisperUser[];
  /** True when Supabase was expected but the home grid fell back to static demo data. */
  catalogDegraded: boolean;
  /** Active hourly feed slot for this user (current hour + paid refresh offset). */
  feedSlot: number;
  /** How many times the user has paid to skip ahead to a fresh slot. */
  refreshOffset: number;
  /** Epoch-ms when the next natural hourly rotation lands. */
  nextRefreshAt: number;
  /** Credit cost to skip ahead to the next slot now. */
  refreshCost: number;
  /** Stable hash of the resulting ordered profile ids — used by the client
   *  to key per-feed UI state so it resets when the feed composition changes. */
  feedHash: string;
};

/**
 * Look up the per-user `refresh_offset` (paid-refresh counter) without
 * blowing up if the table doesn't exist yet (e.g. migration not applied).
 */
export async function fetchRefreshOffset(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from("home_feed_state")
      .select("refresh_offset")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return 0;
    const v = (data as { refresh_offset?: number } | null)?.refresh_offset;
    return typeof v === "number" && v >= 0 ? Math.floor(v) : 0;
  } catch {
    return 0;
  }
}

function bundleMeta(
  refreshOffset: number,
  variant: AppVariant,
  now: number = Date.now(),
) {
  return {
    feedSlot: activeFeedSlot(now, refreshOffset),
    refreshOffset,
    nextRefreshAt: nextHourBoundary(now),
    refreshCost: hourlyFeedRefreshCostForVariant(variant),
  };
}

function pickDiscoverFeed(
  pool: Profile[],
  userKey: string,
  feedSlot: number,
  history: ProfileViewHistory = { excludeIds: new Set(), demoteIds: new Set() },
  size: number = HOURLY_FEED_SIZE,
): Profile[] {
  const picked = pickHourlyFeedWithHistory(pool, userKey, feedSlot, {
    excludeIds: history.excludeIds,
    demoteIds: history.demoteIds,
    size,
  });
  return applyDiscoverFeedStatusToProfiles(picked, userKey, feedSlot);
}

/**
 * Resolve the user's current discover pack with slot-stable ordering.
 *
 * Within a single slot the pack is cached server-side (in `home_feed_state`)
 * so the user always resumes exactly where they left off, even though the
 * underlying history grows with every swipe. When the slot rotates (timer
 * hits 0 or paid refresh), `forceRebuild` is set or the cached slot no
 * longer matches and we recompute from scratch — that's where `excludeIds`
 * and `demoteIds` are applied.
 *
 * Chat-opened profiles are filtered out at read time too, so once you open
 * a chat with someone they disappear from the cached pack within the
 * current slot without reshuffling everyone else.
 */
async function getOrBuildCachedPack(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  pool: Profile[],
  slot: number,
  history: ProfileViewHistory,
  opts: { forceRebuild?: boolean } = {},
): Promise<Profile[]> {
  // Map for cheap id -> Profile lookups.
  const byId = new Map<string, Profile>();
  for (const p of pool) byId.set(p.id, p);

  if (!opts.forceRebuild) {
    try {
      const { data } = await supabase
        .from("home_feed_state")
        .select("cached_pack_slot, cached_pack_ids")
        .eq("user_id", userId)
        .maybeSingle();
      const row = data as {
        cached_pack_slot?: number | null;
        cached_pack_ids?: string[] | null;
      } | null;
      if (
        row?.cached_pack_slot === slot &&
        Array.isArray(row.cached_pack_ids) &&
        row.cached_pack_ids.length > 0
      ) {
        // Reuse cached order; strip any profile the user has since
        // opened a chat with (they live in /messages now).
        const resolved: Profile[] = [];
        for (const id of row.cached_pack_ids) {
          if (history.excludeIds.has(id)) continue;
          const p = byId.get(id);
          if (p) resolved.push(p);
        }
        if (resolved.length > 0) {
          return applyDiscoverFeedStatusToProfiles(resolved, userId, slot);
        }
        // Cached set became empty (rare) — fall through to rebuild.
      }
    } catch {
      /* fall through to rebuild */
    }
  }

  // Build fresh and persist for the rest of this slot.
  const fresh = pickHourlyFeedWithHistory(pool, userId, slot, {
    excludeIds: history.excludeIds,
    demoteIds: history.demoteIds,
    size: HOURLY_FEED_SIZE,
  });
  try {
    await supabase
      .from("home_feed_state")
      .upsert(
        {
          user_id: userId,
          cached_pack_slot: slot,
          cached_pack_ids: fresh.map((p) => p.id),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
  } catch {
    /* best effort — cache is an optimization, not a hard requirement */
  }
  return applyDiscoverFeedStatusToProfiles(fresh, userId, slot);
}

export async function buildDiscoverPackForRefresh(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  pool: Profile[],
  slot: number,
): Promise<Profile[]> {
  const history = await loadProfileViewHistory(supabase, userId);
  return getOrBuildCachedPack(supabase, userId, pool, slot, history, {
    forceRebuild: true,
  });
}

export async function fetchHomePageCatalogServer(
  options: CatalogVariantOptions = {},
): Promise<HomePageCatalogBundle> {
  const variant = options.variant ?? DEFAULT_APP_VARIANT;
  const allLiveVariants = options.allLiveVariants ?? false;
  const now = Date.now();
  const { consumeFunnelPickedPeerServer } = await import(
    "@/lib/catalog/funnel-picked-peer"
  );
  const funnelPickedId = await consumeFunnelPickedPeerServer();

  const staticPool = staticCatalogProfiles(variant);

  if (hasServerDevBypassCookie() || !isSupabaseConfigured()) {
    const { getNewWhisperUsers } = await import("@/data/newUsers");
    const meta = bundleMeta(0, variant, now);
    const gridProfiles = pinProfileFirstInFeed(
      pickDiscoverFeed(staticPool, "guest", meta.feedSlot),
      staticPool,
      funnelPickedId,
    );
    return {
      gridProfiles,
      activityUsers: getNewWhisperUsers(),
      catalogDegraded: false,
      feedHash: hashFeedComposition(gridProfiles.map((p) => p.id)),
      ...meta,
    };
  }

  let supabase: ReturnType<typeof createClient>;
  try {
    supabase = createClient();
  } catch {
    const { getNewWhisperUsers } = await import("@/data/newUsers");
    const meta = bundleMeta(0, variant, now);
    const gridProfiles = pinProfileFirstInFeed(
      pickDiscoverFeed(staticPool, "guest", meta.feedSlot),
      staticPool,
      funnelPickedId,
    );
    return {
      gridProfiles,
      activityUsers: getNewWhisperUsers(),
      catalogDegraded: true,
      feedHash: hashFeedComposition(gridProfiles.map((p) => p.id)),
      ...meta,
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userKey = user?.id ?? "guest";
  const refreshOffset = user ? await fetchRefreshOffset(supabase, user.id) : 0;
  const meta = bundleMeta(refreshOffset, variant, now);

  if (!user) {
    const { getNewWhisperUsers } = await import("@/data/newUsers");
    const { fetchDiscoverPoolServer } = await import(
      "@/lib/catalog/fetch-discover-pool-server"
    );
    const { pool, degraded } = await fetchDiscoverPoolServer(variant, { allLiveVariants });
    const gridProfiles = pinProfileFirstInFeed(
      pickDiscoverFeed(pool, userKey, meta.feedSlot),
      pool,
      funnelPickedId,
    );
    return {
      gridProfiles,
      activityUsers: getNewWhisperUsers(),
      catalogDegraded: degraded,
      feedHash: hashFeedComposition(gridProfiles.map((p) => p.id)),
      ...meta,
    };
  }

  // Pull a wide pool so the hourly picker can rotate through many subsets.
  let gridQuery = supabase
    .from("chat_profiles")
    .select("*")
    .eq("is_ai", true)
    .order("home_sort", { ascending: true })
    .order("display_name", { ascending: true })
    .limit(allLiveVariants ? 240 : 120);
  gridQuery = applyDiscoverPoolFilters(gridQuery, { variant, allLiveVariants });
  const { data: rows, error: gridError } = await gridQuery;

  let pool: Profile[];
  let gridDegraded = false;
  if (gridError || !rows?.length) {
    console.error("[fetchHomePageCatalogServer] grid", gridError);
    pool = staticPool;
    gridDegraded = true;
  } else {
    pool = (rows as ChatProfileRow[]).map(chatProfileRowToProfile);
  }

  const history = await loadProfileViewHistory(supabase, user.id);
  let gridProfiles = await getOrBuildCachedPack(
    supabase,
    user.id,
    pool,
    meta.feedSlot,
    history,
  );

  if (funnelPickedId) {
    gridProfiles = pinProfileFirstInFeed(gridProfiles, pool, funnelPickedId);
    try {
      await supabase.from("home_feed_state").upsert(
        {
          user_id: user.id,
          cached_pack_slot: meta.feedSlot,
          cached_pack_ids: gridProfiles.map((p) => p.id),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    } catch {
      /* cache update is best-effort */
    }
  }

  let actQuery = supabase
    .from("chat_profiles")
    .select("id, display_name, avatar_url, joined_at")
    .not("joined_at", "is", null)
    .order("joined_at", { ascending: false })
    .limit(12);
  actQuery = applyChatProfilesVariantFilter(actQuery, variant);
  const { data: actRows, error: actError } = await actQuery;

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
    feedHash: hashFeedComposition(gridProfiles.map((p) => p.id)),
    ...meta,
  };
}

/**
 * Full AI catalog for onboarding step 6 (vibe + age + intent matching).
 * Uses anon session when not signed in; RLS allows `SELECT` on `is_ai` rows only.
 */
export async function fetchFunnelCatalogProfilesServer(
  options: CatalogVariantOptions = {},
): Promise<{
  profiles: Profile[];
  catalogDegraded: boolean;
}> {
  const variant = options.variant ?? DEFAULT_APP_VARIANT;
  const staticPool = staticCatalogProfiles(variant);
  if (hasServerDevBypassCookie() || !isSupabaseConfigured()) {
    return { profiles: staticPool, catalogDegraded: false };
  }

  let supabase: ReturnType<typeof createClient>;
  try {
    supabase = createClient();
  } catch {
    return { profiles: staticPool, catalogDegraded: true };
  }

  let funnelQuery = supabase
    .from("chat_profiles")
    .select("*")
    .eq("is_ai", true)
    .order("home_sort", { ascending: true })
    .order("display_name", { ascending: true })
    .limit(250);
  funnelQuery = applyChatProfilesVariantFilter(funnelQuery, variant);
  funnelQuery = applyLiveDiscoverPoolFilter(funnelQuery);
  const { data: rows, error } = await funnelQuery;

  if (error || !rows?.length) {
    if (error) console.error("[fetchFunnelCatalogProfilesServer]", error.message);
    return { profiles: staticPool, catalogDegraded: true };
  }

  return {
    profiles: (rows as ChatProfileRow[]).map(chatProfileRowToProfile),
    catalogDegraded: false,
  };
}

export async function fetchHomeGridProfilesServer(
  options: CatalogVariantOptions = {},
): Promise<Profile[]> {
  const { gridProfiles } = await fetchHomePageCatalogServer(options);
  return gridProfiles;
}

export async function fetchCatalogProfileByIdServer(
  id: string,
  options: CatalogVariantOptions = {},
): Promise<Profile | null> {
  const variant = options.variant ?? (await readServerAppVariant());

  if (hasServerDevBypassCookie() || !isSupabaseConfigured()) {
    if (variant === "v2") return null;
    return getProfileById(id) ?? null;
  }

  // Profile catalog data is public — read it with the service-role client so we
  // skip the (network-bound) auth.getUser() validation and RLS round-trips that
  // made "Bekijk profiel" feel sluggish. Guests can view profiles too.
  const { getServiceSupabase } = await import("@/lib/supabase/admin");
  const admin = getServiceSupabase();

  if (admin) {
    let adminQuery = admin.from("chat_profiles").select("*").eq("id", id);
    adminQuery = applyChatProfilesVariantFilter(adminQuery, variant);
    const { data: row, error } = await adminQuery.maybeSingle();
    if (!error && row && chatProfileMatchesVariant(row as ChatProfileRow, variant)) {
      return chatProfileRowToProfile(row as ChatProfileRow);
    }
    if (!error && !row) {
      if (variant === "v2") return null;
      return getProfileById(id) ?? null;
    }
    // On admin error fall through to the anon client below.
  }

  let supabase: ReturnType<typeof createClient>;
  try {
    supabase = createClient();
  } catch {
    if (variant === "v2") return null;
    return getProfileById(id) ?? null;
  }

  let profileQuery = supabase.from("chat_profiles").select("*").eq("id", id);
  profileQuery = applyChatProfilesVariantFilter(profileQuery, variant);
  const { data: row, error } = await profileQuery.maybeSingle();

  if (error || !row) {
    if (variant === "v2") return null;
    return getProfileById(id) ?? null;
  }

  if (!chatProfileMatchesVariant(row as ChatProfileRow, variant)) {
    return null;
  }

  return chatProfileRowToProfile(row as ChatProfileRow);
}

export async function fetchActivityStripUsersServer(
  options: CatalogVariantOptions = {},
): Promise<NewWhisperUser[]> {
  const { activityUsers } = await fetchHomePageCatalogServer(options);
  return activityUsers;
}
