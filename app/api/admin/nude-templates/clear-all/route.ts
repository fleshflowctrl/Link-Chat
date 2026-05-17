import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { SCENE_TEMPLATES_TABLE } from "@/lib/admin/scene-templates-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Hard-delete every active nude template so the operator can start
 * with a clean slate before generating a fresh, more-varied batch.
 * Rejected nude templates are kept around (their rejection reasons
 * still feed back into Grok). */
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

  const { data, error } = await service
    .from(SCENE_TEMPLATES_TABLE)
    .delete()
    .eq("category", "nude")
    .eq("is_active", true)
    .select("id");
  if (error) {
    return NextResponse.json(
      { error: `Verwijderen mislukt: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    deleted: Array.isArray(data) ? data.length : 0,
  });
}
