/**
 * Bulk persona action endpoint.
 *
 * POST /api/admin/personas/bulk-delete
 * Body: { ids: string[], mode: "archive" | "restore" | "hard" }
 *
 * Returns counts and per-id results so the admin UI can show partial
 * successes when one row fails (e.g. storage list timeout).
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { purgePersonaStorage } from "@/lib/admin/persona-delete";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Mode = "archive" | "restore" | "hard";

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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON." }, { status: 400 });
  }

  const idsRaw = (body as { ids?: unknown }).ids;
  const modeRaw = (body as { mode?: unknown }).mode;
  const mode: Mode =
    modeRaw === "hard" ? "hard" : modeRaw === "restore" ? "restore" : "archive";

  const ids: string[] = Array.isArray(idsRaw)
    ? idsRaw.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "Geen ids opgegeven." }, { status: 400 });
  }
  if (ids.length > 200) {
    return NextResponse.json(
      { error: "Maximaal 200 personas tegelijk." },
      { status: 400 },
    );
  }

  // Soft modes — single SQL update.
  if (mode === "archive" || mode === "restore") {
    const { error, count } = await service
      .from("chat_profiles")
      .update(
        { is_archived: mode === "archive" },
        { count: "exact" },
      )
      .in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      ok: true,
      mode,
      affected: count ?? ids.length,
    });
  }

  // Hard mode — purge storage per id (best effort), then delete in one shot.
  const perId: Array<{ id: string; storage: { removed: number; errors: string[] } }> = [];
  let totalStorageRemoved = 0;
  for (const id of ids) {
    const purge = await purgePersonaStorage(service, id);
    perId.push({ id, storage: purge });
    totalStorageRemoved += purge.removed;
  }

  const { error: delErr, count: delCount } = await service
    .from("chat_profiles")
    .delete({ count: "exact" })
    .in("id", ids);
  if (delErr) {
    return NextResponse.json(
      {
        error: delErr.message,
        partial: { storageRemoved: totalStorageRemoved, perId },
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    mode,
    affected: delCount ?? ids.length,
    storage: { removed: totalStorageRemoved },
  });
}
