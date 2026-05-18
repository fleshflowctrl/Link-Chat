import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Lightweight presence ping. The app shell calls this every ~30s while
 * the tab is visible so /admin/metrics can compute "Online now".
 * No body — the auth cookie already identifies the user.
 */
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("user_profiles")
    .update({ last_active_at: now })
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
