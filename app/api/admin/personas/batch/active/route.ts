import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Return the admin's most recent unfinished batch (if any) so the
 * BulkGenerateCard can resume showing progress when the page is
 * re-opened mid-run. We surface the batchId only; the UI follows up
 * with GET /api/admin/personas/batch/{id} for full state. */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const service = getServiceSupabase();
  if (!service) {
    return NextResponse.json({ batch: null });
  }

  const { data, error } = await service
    .from("chat_persona_batches")
    .select("id, status, total, created_at, updated_at")
    .eq("owner_user_id", auth.userId)
    .in("status", ["pending", "running"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ batch: null, error: error.message });
  }
  return NextResponse.json({ batch: data ?? null });
}
