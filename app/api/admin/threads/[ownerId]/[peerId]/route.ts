import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import {
  messageRowToUi,
  type ChatMessageRow,
  type ChatProfileRow,
} from "@/lib/chat/map-rows";

export const dynamic = "force-dynamic";

export type AdminThreadDetail = {
  ownerUserId: string;
  ownerEmail: string | null;
  peer: {
    id: string;
    name: string;
    avatarUrl: string;
  };
  messages: ReturnType<typeof messageRowToUi>[];
};

/** Returns the full message list for a single (user, peer) thread. */
export async function GET(
  _request: Request,
  { params }: { params: { ownerId: string; peerId: string } },
) {
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

  const { ownerId, peerId } = params;

  const [{ data: msgs, error: me }, { data: prof }, { data: userData }] =
    await Promise.all([
      service
        .from("chat_messages")
        .select("*")
        .eq("owner_user_id", ownerId)
        .eq("peer_id", peerId)
        .order("created_at", { ascending: true }),
      service
        .from("chat_profiles")
        .select("id, display_name, avatar_url")
        .eq("id", peerId)
        .maybeSingle(),
      service.auth.admin.getUserById(ownerId),
    ]);

  if (me) {
    return NextResponse.json(
      { ok: false, error: me.message },
      { status: 500 },
    );
  }

  const profile = prof as Pick<
    ChatProfileRow,
    "id" | "display_name" | "avatar_url"
  > | null;

  const detail: AdminThreadDetail = {
    ownerUserId: ownerId,
    ownerEmail: userData?.user?.email ?? null,
    peer: {
      id: peerId,
      name: profile?.display_name ?? peerId,
      avatarUrl: profile?.avatar_url ?? "",
    },
    messages: ((msgs ?? []) as ChatMessageRow[]).map(messageRowToUi),
  };

  return NextResponse.json({ ok: true, ...detail });
}
