import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_RX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Links a visitor (cookie/localStorage UUID) to the auth user that just
 * signed up. Called from the funnel right after a successful `signUp`.
 *
 * Idempotent: if the row was already linked, the call is a no-op.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const obj = (body && typeof body === "object" ? body : {}) as Record<
    string,
    unknown
  >;
  const visitorId =
    typeof obj.visitorId === "string" ? obj.visitorId.trim() : "";
  if (!visitorId || !UUID_RX.test(visitorId)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const service = getServiceSupabase();
  if (!service) {
    return NextResponse.json(
      { ok: false, error: "service not configured" },
      { status: 503 },
    );
  }

  // We accept an explicit userId from the client too, so the linker can
  // run during the email-confirm flow (no active session yet).
  const explicitUserId =
    typeof obj.userId === "string" && UUID_RX.test(obj.userId.trim())
      ? obj.userId.trim()
      : null;

  const userId = user?.id ?? explicitUserId;
  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "no user id" },
      { status: 401 },
    );
  }

  const now = new Date().toISOString();

  // Upsert: if visitor row doesn't exist yet (rare race), create it.
  const { data: existing } = await service
    .from("site_visits")
    .select("visitor_id, signed_up_user_id")
    .eq("visitor_id", visitorId)
    .maybeSingle();

  if (existing) {
    const row = existing as { signed_up_user_id: string | null };
    if (!row.signed_up_user_id) {
      await service
        .from("site_visits")
        .update({ signed_up_user_id: userId, signed_up_at: now })
        .eq("visitor_id", visitorId);
    }
  } else {
    await service.from("site_visits").insert({
      visitor_id: visitorId,
      first_visit_at: now,
      last_visit_at: now,
      visit_count: 1,
      signed_up_user_id: userId,
      signed_up_at: now,
    });
  }

  return NextResponse.json({ ok: true });
}
