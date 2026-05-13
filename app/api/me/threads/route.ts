import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { isSupabaseConfigured } from "@/utils/supabase/public-env";
import {
  mergeProfileWithLatestUserMessage,
  type ChatMessageRow,
  type ChatProfileRow,
} from "@/lib/chat/map-rows";

export const dynamic = "force-dynamic";

/**
 * Returns the inbox thread list for the authenticated user.
 *
 * A "thread" exists for a user when they've exchanged at least one message
 * with that peer. Each thread row is built from the matching `chat_profiles`
 * persona + the latest `chat_messages` row for that peer scoped to this user.
 */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, threads: [], anonymous: true });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: true, threads: [], anonymous: true });
  }

  const { data: msgs, error } = await supabase
    .from("chat_messages")
    .select("peer_id, body, kind, image_url, reaction_emoji, created_at")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  const rows = (msgs ?? []) as Array<
    Pick<
      ChatMessageRow,
      "peer_id" | "body" | "kind" | "image_url" | "reaction_emoji" | "created_at"
    >
  >;

  const latestByPeer = new Map<
    string,
    Pick<
      ChatMessageRow,
      "peer_id" | "body" | "kind" | "image_url" | "reaction_emoji" | "created_at"
    >
  >();
  for (const m of rows) {
    if (!latestByPeer.has(m.peer_id)) latestByPeer.set(m.peer_id, m);
  }

  const peerIds = Array.from(latestByPeer.keys());
  if (peerIds.length === 0) {
    return NextResponse.json({ ok: true, threads: [], anonymous: false });
  }

  const { data: profiles, error: pe } = await supabase
    .from("chat_profiles")
    .select("*")
    .in("id", peerIds);

  if (pe) {
    return NextResponse.json(
      { ok: false, error: pe.message },
      { status: 500 },
    );
  }

  const profileById = new Map<string, ChatProfileRow>();
  for (const p of (profiles ?? []) as ChatProfileRow[]) {
    profileById.set(p.id, p);
  }

  const threads = peerIds
    .map((peerId) => {
      const profile = profileById.get(peerId);
      const latest = latestByPeer.get(peerId);
      if (!profile || !latest) return null;
      return mergeProfileWithLatestUserMessage(profile, latest);
    })
    .filter((t): t is NonNullable<typeof t> => t !== null)
    .sort(
      (a, b) =>
        new Date(b.lastActivityAt ?? 0).getTime() -
        new Date(a.lastActivityAt ?? 0).getTime(),
    );

  return NextResponse.json({ ok: true, threads, anonymous: false });
}
