import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import {
  deleteTemplates,
  invalidateDbStateCache,
} from "@/lib/admin/scene-templates-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type BulkBody = {
  /** Currently only "delete" is supported — bulk-reject would require
   * a reason for the feedback loop, and the operator's request was
   * specifically to remove templates *without* having to type a reason
   * each time, so we just hard-delete. */
  action?: "delete";
  ids?: string[];
};

export async function POST(req: Request) {
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

  let body: BulkBody;
  try {
    body = (await req.json()) as BulkBody;
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON." }, { status: 400 });
  }

  const action = body.action ?? "delete";
  if (action !== "delete") {
    return NextResponse.json(
      { error: `Onbekende action: ${action}` },
      { status: 400 },
    );
  }

  const ids = Array.isArray(body.ids)
    ? body.ids.filter((v): v is string => typeof v === "string" && v.length > 0)
    : [];
  if (ids.length === 0) {
    return NextResponse.json(
      { error: "Geen ids opgegeven." },
      { status: 400 },
    );
  }

  try {
    const { deleted } = await deleteTemplates(service, ids);
    invalidateDbStateCache();
    return NextResponse.json({ ok: true, deleted });
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
