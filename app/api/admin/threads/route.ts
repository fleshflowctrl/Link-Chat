import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import {
  loadAdminChatUsers,
  type AdminChatUserSummary,
  type AdminThreadSummary,
} from "@/lib/admin/chat-threads";

export const dynamic = "force-dynamic";

export type { AdminChatUserSummary, AdminThreadSummary };

/**
 * GET /api/admin/threads — users with chat activity (default).
 * GET /api/admin/threads?ownerId=… — conversations for one user.
 */
export async function GET(request: Request) {
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

  const ownerId = new URL(request.url).searchParams.get("ownerId");

  try {
    if (ownerId) {
      const { loadAdminUserThreads } = await import("@/lib/admin/chat-threads");
      const threads = await loadAdminUserThreads(service, ownerId);
      return NextResponse.json({ ok: true, threads });
    }

    const users = await loadAdminChatUsers(service);
    return NextResponse.json({ ok: true, users });
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
