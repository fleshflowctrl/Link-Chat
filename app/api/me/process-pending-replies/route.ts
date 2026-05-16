import { NextResponse } from "next/server";

import { processPendingForOwner } from "@/lib/ai/process-pending-for-owner";
import { createClient } from "@/utils/supabase/server";
import { isSupabaseConfigured } from "@/utils/supabase/public-env";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST — deliver due AI replies for the signed-in user (all threads).
 * Called from the app shell heartbeat so chats keep going on /discover,
 * /messages, etc., not only inside an open conversation.
 */
export async function POST() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, skipped: true, anonymous: true });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: true, skipped: true, anonymous: true });
  }

  try {
    const result = await processPendingForOwner(supabase, {
      ownerUserId: user.id,
      maxThreads: 6,
      scheduleWinback: true,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[POST /api/me/process-pending-replies]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
