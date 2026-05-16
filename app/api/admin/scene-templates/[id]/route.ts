import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import {
  invalidateDbStateCache,
  rejectTemplate,
  REJECTION_TAGS,
  restoreTemplate,
  type RejectionTag,
} from "@/lib/admin/scene-templates-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteCtx = { params: { id: string } };

type PatchBody = {
  action?: "reject" | "restore";
  reason?: string;
  tags?: string[];
};

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

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON." }, { status: 400 });
  }

  const id = ctx.params.id;
  if (!id) {
    return NextResponse.json({ error: "id ontbreekt." }, { status: 400 });
  }

  try {
    if (body.action === "restore") {
      const row = await restoreTemplate(service, id);
      invalidateDbStateCache();
      return NextResponse.json({ ok: true, template: row });
    }
    // Default action = reject.
    const reason = (body.reason ?? "").trim();
    if (reason.length < 4) {
      return NextResponse.json(
        { error: "Reden is te kort (min. 4 tekens)." },
        { status: 400 },
      );
    }
    const tags = Array.isArray(body.tags)
      ? body.tags.filter((t): t is RejectionTag =>
          (REJECTION_TAGS as readonly string[]).includes(t),
        )
      : [];
    const row = await rejectTemplate(service, id, { reason, tags });
    invalidateDbStateCache();
    return NextResponse.json({ ok: true, template: row });
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
