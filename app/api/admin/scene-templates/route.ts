import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import {
  listTemplateIds,
  listTemplates,
  type ListOpts,
} from "@/lib/admin/scene-templates-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
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

  const url = new URL(req.url);
  const opts: ListOpts = {
    page: Number(url.searchParams.get("page") ?? "1"),
    pageSize: Number(url.searchParams.get("pageSize") ?? "50"),
  };
  const kind = url.searchParams.get("kind");
  if (kind === "avatar" || kind === "gallery" || kind === "mixed" || kind === "any") {
    opts.kind = kind;
  }
  const category = url.searchParams.get("category");
  if (category && category.trim().length > 0) opts.category = category.trim();
  const state = url.searchParams.get("state");
  if (state === "active" || state === "rejected" || state === "any") {
    opts.state = state;
  } else {
    opts.state = "active";
  }
  const sort = url.searchParams.get("sort");
  if (sort === "newest" || sort === "oldest") opts.sort = sort;

  // Lightweight mode for the "select all matching filter" UI affordance:
  // returns every id for the current filter (capped server-side at 10k)
  // without paginating or hydrating full rows.
  const idsOnly = url.searchParams.get("idsOnly");
  if (idsOnly === "1" || idsOnly === "true") {
    try {
      const ids = await listTemplateIds(service, {
        kind: opts.kind,
        category: opts.category,
        state: opts.state,
        sort: opts.sort,
      });
      return NextResponse.json({ ok: true, ids, total: ids.length });
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

  try {
    const result = await listTemplates(service, opts);
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
