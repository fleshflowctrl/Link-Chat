import { NextResponse } from "next/server";
import {
  activeFeedSlot,
  hashFeedComposition,
  hourlyFeedRefreshCostForVariant,
  nextHourBoundary,
} from "@/lib/catalog/hourly-feed";
import type { Profile } from "@/data/profiles";
import type { ChatProfileRow } from "@/lib/chat/map-rows";
import { readServerAppVariant } from "@/lib/app-variant";
import { chatProfileRowToProfile } from "@/lib/catalog/chat-profile-to-profile";
import { applyChatProfilesVariantFilter, staticCatalogProfiles } from "@/lib/catalog/profile-variant";
import { buildDiscoverPackForRefresh } from "@/lib/catalog/server-catalog";
import { createClient } from "@/utils/supabase/server";
import { isSupabaseConfigured } from "@/utils/supabase/public-env";

export const dynamic = "force-dynamic";

/**
 * Pay variant-specific credits ({@link hourlyFeedRefreshCostForVariant}) to skip ahead to the next
 * hourly feed slot immediately. Atomic-ish:
 *
 * 1. Validate the user has enough credits.
 * 2. Deduct the cost from `user_profiles.credits`.
 * 3. Increment `home_feed_state.refresh_offset` (upserts on first refresh).
 * 4. If step 3 fails, refund step 2 and return an error.
 *
 * Returns the brand-new feed slice so the client doesn't need a follow-up GET.
 */
export async function POST() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: "supabase not configured" },
      { status: 503 },
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "not signed in" },
      { status: 401 },
    );
  }

  const { data: prof, error: profErr } = await supabase
    .from("user_profiles")
    .select("credits")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profErr) {
    return NextResponse.json(
      { ok: false, error: profErr.message },
      { status: 500 },
    );
  }

  const balanceBefore =
    typeof (prof as { credits?: number } | null)?.credits === "number"
      ? ((prof as { credits?: number }).credits as number)
      : 0;

  const variant = await readServerAppVariant();
  const refreshCost = hourlyFeedRefreshCostForVariant(variant);

  if (balanceBefore < refreshCost) {
    return NextResponse.json(
      {
        ok: false,
        error: "insufficient credits",
        balance: balanceBefore,
        cost: refreshCost,
      },
      { status: 402 },
    );
  }

  const newBalance = balanceBefore - refreshCost;
  const { error: updErr } = await supabase
    .from("user_profiles")
    .update({ credits: newBalance, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);
  if (updErr) {
    return NextResponse.json(
      { ok: false, error: updErr.message },
      { status: 500 },
    );
  }

  // Read the current offset (default 0), bump it by 1, persist.
  let currentOffset = 0;
  try {
    const { data: state } = await supabase
      .from("home_feed_state")
      .select("refresh_offset")
      .eq("user_id", user.id)
      .maybeSingle();
    const v = (state as { refresh_offset?: number } | null)?.refresh_offset;
    currentOffset = typeof v === "number" && v >= 0 ? Math.floor(v) : 0;
  } catch {
    currentOffset = 0;
  }

  const nextOffset = currentOffset + 1;

  const { error: upsertErr } = await supabase
    .from("home_feed_state")
    .upsert(
      {
        user_id: user.id,
        refresh_offset: nextOffset,
        last_paid_refresh_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (upsertErr) {
    // Refund — couldn't persist the bump.
    await supabase
      .from("user_profiles")
      .update({ credits: balanceBefore })
      .eq("user_id", user.id);
    return NextResponse.json(
      { ok: false, error: upsertErr.message },
      { status: 500 },
    );
  }

  // Build a fresh slice using the new offset so the client can swap in place.
  const now = Date.now();
  const slot = activeFeedSlot(now, nextOffset);

  let pool: Profile[] = staticCatalogProfiles(variant);
  try {
    let refreshQuery = supabase
      .from("chat_profiles")
      .select("*")
      .order("home_sort", { ascending: true })
      .order("display_name", { ascending: true })
      .limit(120);
    refreshQuery = applyChatProfilesVariantFilter(refreshQuery, variant);
    const { data: rows } = await refreshQuery;
    if (rows && rows.length > 0) {
      pool = (rows as ChatProfileRow[]).map(chatProfileRowToProfile);
    }
  } catch {
    /* fall back to static pool */
  }

  // Paid refresh = explicit "give me a brand-new pack now", so we rebuild
  // the cache (this also consumes any seen-history demotions accumulated
  // during the previous slot).
  const refreshed = await buildDiscoverPackForRefresh(
    supabase,
    user.id,
    pool,
    slot,
  );

  return NextResponse.json({
    ok: true,
    profiles: refreshed,
    feedSlot: slot,
    refreshOffset: nextOffset,
    nextRefreshAt: nextHourBoundary(now),
    refreshCost,
    feedHash: hashFeedComposition(refreshed.map((p) => p.id)),
    balance: newBalance,
  });
}
