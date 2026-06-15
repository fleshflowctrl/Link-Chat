import { NextResponse } from "next/server";
import { readServerAppVariant } from "@/lib/app-variant";
import { chatProfileMatchesVariant } from "@/lib/catalog/profile-variant";
import { createClient } from "@/utils/supabase/server";

// Reads the signed-in user's cookies — must run per-request, never prerendered.
export const dynamic = "force-dynamic";

/**
 * GET /api/me/chat-photos
 *
 * Returns all photos the signed-in user has unlocked from chat
 * (via 50-credit paywall), grouped by persona.
 *
 * Shape:
 * {
 *   ok: true,
 *   groups: [
 *     {
 *       peerId: string,
 *       name: string,
 *       avatarUrl: string,
 *       photos: [{ id, imageUrl, unlockedAt }]
 *     },
 *     ...
 *   ]
 * }
 */
export async function GET() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Niet geautoriseerd" }, { status: 401 });
  }

  const variant = await readServerAppVariant();

  const { data, error } = await supabase
    .from("chat_photo_unlocks")
    .select(
      `
      unlocked_at,
      message:chat_messages(
        id,
        image_url,
        created_at,
        peer:chat_profiles(id, display_name, avatar_url, app_variant)
      )
    `,
    )
    .eq("owner_user_id", user.id)
    .order("unlocked_at", { ascending: false });

  if (error) {
    console.error("[me/chat-photos] query error", error);
    return NextResponse.json({ ok: false, error: "Fout bij ophalen" }, { status: 500 });
  }

  type Row = {
    unlocked_at: string;
    message: {
      id: string;
      image_url: string | null;
      created_at: string;
      peer: {
        id: string;
        display_name: string;
        avatar_url: string;
        app_variant?: string | null;
      } | null;
    } | null;
  };

  const groupsMap = new Map<
    string,
    {
      peerId: string;
      name: string;
      avatarUrl: string;
      photos: Array<{ id: string; imageUrl: string; unlockedAt: string }>;
    }
  >();

  for (const row of (data ?? []) as unknown as Row[]) {
    const msg = row.message;
    if (!msg || !msg.image_url || !msg.peer) continue;
    if (!chatProfileMatchesVariant(msg.peer, variant)) continue;

    const peer = msg.peer;
    if (!groupsMap.has(peer.id)) {
      groupsMap.set(peer.id, {
        peerId: peer.id,
        name: peer.display_name,
        avatarUrl: peer.avatar_url,
        photos: [],
      });
    }
    groupsMap.get(peer.id)!.photos.push({
      id: msg.id,
      imageUrl: msg.image_url,
      unlockedAt: row.unlocked_at,
    });
  }

  const groups = Array.from(groupsMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return NextResponse.json({ ok: true, groups });
}
