import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { isSupabaseConfigured } from "@/utils/supabase/public-env";
import { fetchUnreadInboxCountServer } from "@/lib/chat/server-data";

export const dynamic = "force-dynamic";

/**
 * Mark a chat thread as read for the authenticated user.
 *
 * Upserts `chat_reads(owner_user_id, peer_id)` with `last_read_at = now()`.
 * The bottom-nav badge and inbox unread state are derived from the comparison
 * between this timestamp and the latest peer-sender message in `chat_messages`.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ peerId: string }> },
) {
  const { peerId } = await params;
  if (!peerId) {
    return NextResponse.json({ ok: false, error: "missing peerId" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, anonymous: true });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: true, anonymous: true });
  }

  const { error } = await supabase.from("chat_reads").upsert(
    {
      owner_user_id: user.id,
      peer_id: peerId,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: "owner_user_id,peer_id" },
  );

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  // Return the up-to-date unread count so the client can sync the bottom-nav
  // badge baseline immediately, without waiting for the next poll.
  const count = await fetchUnreadInboxCountServer();
  return NextResponse.json({ ok: true, count });
}
