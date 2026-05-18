import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_RX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const MAX_STEP = 20;

/**
 * Records the first time a visitor reaches each onboarding step. Primary
 * key (visitor_id, step) collapses retries — we ignore conflicts so the
 * client can fire freely on every render without inflating numbers.
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
  const stepRaw = obj.step;
  const step =
    typeof stepRaw === "number"
      ? Math.floor(stepRaw)
      : typeof stepRaw === "string"
        ? parseInt(stepRaw, 10)
        : NaN;

  if (!visitorId || !UUID_RX.test(visitorId)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!Number.isFinite(step) || step < 1 || step > MAX_STEP) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const service = getServiceSupabase();
  if (!service) {
    return NextResponse.json(
      { ok: false, error: "service not configured" },
      { status: 503 },
    );
  }

  const { error } = await service
    .from("funnel_step_views")
    .upsert(
      {
        visitor_id: visitorId,
        step,
        first_viewed_at: new Date().toISOString(),
      },
      { onConflict: "visitor_id,step", ignoreDuplicates: true },
    );

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
