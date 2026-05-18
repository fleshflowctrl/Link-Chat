import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { setMetricsSince } from "@/lib/admin/metrics-settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Password gate for the metrics reset action. Override via env. */
const DEFAULT_RESET_PASSWORD = "131313";

function getResetPassword(): string {
  const env = process.env.ADMIN_METRICS_RESET_PASSWORD?.trim();
  return env && env.length > 0 ? env : DEFAULT_RESET_PASSWORD;
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Ongeldige body" },
      { status: 400 },
    );
  }

  const obj = (body && typeof body === "object" ? body : {}) as Record<
    string,
    unknown
  >;
  const password =
    typeof obj.password === "string" ? obj.password.trim() : "";

  if (password !== getResetPassword()) {
    return NextResponse.json(
      { ok: false, error: "Onjuist wachtwoord" },
      { status: 401 },
    );
  }

  const service = getServiceSupabase();
  if (!service) {
    return NextResponse.json(
      { ok: false, error: "Service-role key ontbreekt" },
      { status: 500 },
    );
  }

  const result = await setMetricsSince(service);
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, metricsSince: result.metricsSince });
}
