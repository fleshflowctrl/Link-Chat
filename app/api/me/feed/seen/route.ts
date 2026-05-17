import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/utils/supabase/public-env";
import { createClient } from "@/utils/supabase/server";
import { recordProfileSeen } from "@/lib/me/profile-views";

export const dynamic = "force-dynamic";

/**
 * Record that the signed-in user just saw `profileId` on /discover.
 *
 * Best-effort, fire-and-forget from the client. Always responds 200 — the
 * feed must keep working even if history writes fail.
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true });
  }

  let profileId: string;
  try {
    const body = (await request.json()) as { profileId?: unknown };
    if (typeof body.profileId !== "string" || !body.profileId.trim()) {
      return NextResponse.json({ ok: true });
    }
    profileId = body.profileId.trim();
  } catch {
    return NextResponse.json({ ok: true });
  }

  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ ok: true });
    }
    await recordProfileSeen(supabase, user.id, profileId);
  } catch {
    /* ignore */
  }
  return NextResponse.json({ ok: true });
}
