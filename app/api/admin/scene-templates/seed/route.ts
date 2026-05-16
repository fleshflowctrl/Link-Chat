import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import {
  invalidateDbStateCache,
  seedFromCode,
} from "@/lib/admin/scene-templates-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** One-shot seed endpoint. Copies the in-code SCENE_TEMPLATES into the
 * DB so the operator can reject / restore / edit them via the admin
 * UI. Idempotent — re-runs only insert templates whose template_id
 * isn't already in the table. */
export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const service = getServiceSupabase();
  if (!service) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY ontbreekt." },
      { status: 500 },
    );
  }
  try {
    const result = await seedFromCode(service);
    invalidateDbStateCache();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
