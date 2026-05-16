import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { generateSceneTemplateBatch } from "@/lib/admin/scene-template-generator";
import {
  insertTemplates,
  invalidateDbStateCache,
} from "@/lib/admin/scene-templates-store";
import { randomUUID } from "node:crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Grok can take 30-60s for a 50-template batch. Bump our serverless cap.
export const maxDuration = 120;

type Body = {
  count?: number;
  hints?: string[];
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

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON." }, { status: 400 });
  }
  const count = Math.max(1, Math.min(80, Math.floor(Number(body.count) || 50)));
  const hints = Array.isArray(body.hints)
    ? body.hints.filter((s): s is string => typeof s === "string").slice(0, 8)
    : [];

  const generated = await generateSceneTemplateBatch(service, { count, hints });
  if (!generated.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: generated.error,
        rawText: "rawText" in generated ? generated.rawText : undefined,
      },
      { status: 502 },
    );
  }

  const batchId = `grok-batch-${randomUUID()}`;
  const inserted = await insertTemplates(service, generated.templates, {
    source: batchId,
  });
  // Invalidate the picker cache so newly-inserted templates show up
  // immediately to the next photo gen.
  invalidateDbStateCache();

  return NextResponse.json({
    ok: true,
    batchId,
    requested: count,
    generated: generated.templates.length,
    droppedInvalid: generated.droppedInvalid,
    inserted: inserted.inserted,
    dedupedSkipped: inserted.skipped,
    model: generated.model,
  });
}
