import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type MessageRow = {
  owner_user_id: string;
  peer_id: string;
  body: string | null;
  kind: string;
  image_url: string | null;
  reaction_emoji: string | null;
  sender: string;
  created_at: string;
};

type ProfileRow = {
  id: string;
  display_name: string;
  avatar_url: string;
};

type AuthUserRow = {
  id: string;
  email: string | null;
};

export type AdminThreadSummary = {
  ownerUserId: string;
  ownerEmail: string | null;
  peerId: string;
  peerName: string;
  peerAvatarUrl: string;
  messageCount: number;
  lastMessageAt: string;
  lastMessagePreview: string;
  lastSender: "me" | "peer";
};

/**
 * Returns every (owner_user_id, peer_id) chat thread in the system, sorted by
 * most recent activity. Service-role read so RLS is bypassed; access guarded
 * by `is_admin` on `user_profiles`.
 */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status },
    );
  }

  const service = getServiceSupabase();
  if (!service) {
    return NextResponse.json(
      { ok: false, error: "Service-role key niet geconfigureerd" },
      { status: 500 },
    );
  }

  const { data: msgs, error } = await service
    .from("chat_messages")
    .select(
      "owner_user_id, peer_id, body, kind, image_url, reaction_emoji, sender, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  const rows = (msgs ?? []) as MessageRow[];

  const counts = new Map<string, number>();
  const latest = new Map<string, MessageRow>();
  for (const m of rows) {
    const key = `${m.owner_user_id}::${m.peer_id}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (!latest.has(key)) latest.set(key, m);
  }

  const peerIds = Array.from(new Set(rows.map((m) => m.peer_id)));
  const ownerIds = Array.from(new Set(rows.map((m) => m.owner_user_id)));

  const peerById = new Map<string, ProfileRow>();
  if (peerIds.length > 0) {
    const { data: profs } = await service
      .from("chat_profiles")
      .select("id, display_name, avatar_url")
      .in("id", peerIds);
    for (const p of (profs ?? []) as ProfileRow[]) peerById.set(p.id, p);
  }

  const emailById = new Map<string, string | null>();
  if (ownerIds.length > 0) {
    // `auth.admin.listUsers` is paginated. For the admin panel scale (small
    // beta) we just walk a reasonable page size; bump as needed.
    let page = 1;
    const perPage = 200;
    while (true) {
      const { data, error: lue } = await service.auth.admin.listUsers({
        page,
        perPage,
      });
      if (lue) break;
      const users = (data?.users ?? []) as AuthUserRow[];
      for (const u of users) emailById.set(u.id, u.email ?? null);
      if (users.length < perPage) break;
      page += 1;
      if (page > 10) break; // safety cap (~2000 users)
    }
  }

  const threads: AdminThreadSummary[] = Array.from(latest.entries())
    .map(([key, m]) => {
      const profile = peerById.get(m.peer_id);
      const preview =
        m.kind === "image"
          ? "Foto"
          : m.reaction_emoji
            ? "Reactie"
            : (m.body ?? "").trim() || "Bericht";
      return {
        ownerUserId: m.owner_user_id,
        ownerEmail: emailById.get(m.owner_user_id) ?? null,
        peerId: m.peer_id,
        peerName: profile?.display_name ?? m.peer_id,
        peerAvatarUrl: profile?.avatar_url ?? "",
        messageCount: counts.get(key) ?? 1,
        lastMessageAt: m.created_at,
        lastMessagePreview: preview,
        lastSender: (m.sender === "me" ? "me" : "peer") as "me" | "peer",
      };
    })
    .sort(
      (a, b) =>
        new Date(b.lastMessageAt).getTime() -
        new Date(a.lastMessageAt).getTime(),
    );

  return NextResponse.json({ ok: true, threads });
}
