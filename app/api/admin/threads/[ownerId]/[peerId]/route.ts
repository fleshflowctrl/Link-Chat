import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import {
  loadAdminThreadDetail,
  type AdminThreadDetail,
} from "@/lib/admin/chat-threads";

export const dynamic = "force-dynamic";

export type { AdminThreadDetail };

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

  try {
    const detail = await loadAdminThreadDetail(service, ownerId, peerId);
    return NextResponse.json({ ok: true, ...detail });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Laden mislukt",
      },
      { status: 500 },
    );
  }
}
