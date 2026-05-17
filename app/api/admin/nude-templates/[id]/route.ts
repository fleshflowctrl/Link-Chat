import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { rejectTemplate, restoreTemplate, deleteTemplates } from "@/lib/admin/scene-templates-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteCtx = { params: { id: string } };

/** PATCH = reject / restore. DELETE = hard delete. */
export async function PATCH(req: Request, ctx: RouteCtx) {
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

  let body: { action?: string; reason?: string; tags?: string[] };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON" }, { status: 400 });
  }

  try {
    if (body.action === "restore") {
      const row = await restoreTemplate(service, ctx.params.id);
      return NextResponse.json({ ok: true, template: row });
    }

    const reason = (body.reason ?? "").trim();
    if (!reason) {
      return NextResponse.json({ error: "reason is verplicht" }, { status: 400 });
    }

    const row = await rejectTemplate(service, ctx.params.id, {
      reason,
      tags: Array.isArray(body.tags)
        ? (body.tags.filter((t) => typeof t === "string") as never)
        : undefined,
    });
    return NextResponse.json({ ok: true, template: row });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
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
    const result = await deleteTemplates(service, [ctx.params.id]);
    return NextResponse.json({ ok: true, deleted: result.deleted });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
