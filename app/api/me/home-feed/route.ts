import { NextResponse } from "next/server";
import { fetchHomePageCatalogServer } from "@/lib/catalog/server-catalog";

export const dynamic = "force-dynamic";

/**
 * GET the current hourly home feed slice + countdown metadata. Mirrors what
 * /discover renders server-side, so the client can re-poll on tab focus or
 * after a paid refresh without a full page reload.
 */
export async function GET() {
  const bundle = await fetchHomePageCatalogServer();
  return NextResponse.json({
    ok: true,
    profiles: bundle.gridProfiles,
    feedSlot: bundle.feedSlot,
    refreshOffset: bundle.refreshOffset,
    nextRefreshAt: bundle.nextRefreshAt,
    refreshCost: bundle.refreshCost,
  });
}
