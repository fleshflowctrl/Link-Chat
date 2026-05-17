import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_RX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function clamp(s: string | undefined | null, max = 500): string | null {
  if (!s) return null;
  const t = String(s).trim();
  return t ? t.slice(0, max) : null;
}

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

  const service = getServiceSupabase();
  if (!service) {
    return NextResponse.json(
      { ok: false, error: "service not configured" },
      { status: 503 },
    );
  }

  const userAgent = clamp(req.headers.get("user-agent"), 300);
  const referrer =
    clamp(typeof obj.referrer === "string" ? obj.referrer : null, 500) ??
    clamp(req.headers.get("referer"), 500);

  const { data: existing } = await service
    .from("site_visits")
    .select("visitor_id, visit_count")
    .eq("visitor_id", visitorId)
    .maybeSingle();

  const now = new Date().toISOString();

  if (existing) {
    const next =
      typeof (existing as { visit_count?: number }).visit_count === "number"
        ? (existing as { visit_count: number }).visit_count + 1
        : 1;
    await service
      .from("site_visits")
      .update({ last_visit_at: now, visit_count: next })
      .eq("visitor_id", visitorId);
  } else {
    await service.from("site_visits").insert({
      visitor_id: visitorId,
      first_visit_at: now,
      last_visit_at: now,
      visit_count: 1,
      user_agent: userAgent,
      referrer,
    });
  }

  return NextResponse.json({ ok: true });
}
