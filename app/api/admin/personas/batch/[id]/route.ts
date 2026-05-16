import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import {
  resolveBaseUrl,
  triggerNextTick,
  type BatchItemRow,
  type BatchRow,
} from "@/lib/admin/persona-batch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteCtx = { params: { id: string } };

/** Project a batch + items row pair into the shape the BulkGenerateCard
 * UI consumes. Keeps the wire format small + stable. */
function projectBatch(batch: BatchRow, items: BatchItemRow[]) {
  return {
    id: batch.id,
    status: batch.status,
    total: batch.total,
    brief: batch.brief,
    with_photos: batch.with_photos,
    gallery_target: batch.gallery_target,
    attractiveness: batch.attractiveness,
    body_type: batch.body_type,
    age_min: batch.age_min,
    age_max: batch.age_max,
    last_error: batch.last_error,
    created_at: batch.created_at,
    updated_at: batch.updated_at,
    finished_at: batch.finished_at,
    items: items.map((it) => ({
      idx: it.idx,
      profile_state: it.profile_state,
      photo_state: it.photo_state,
      gallery_state: it.gallery_state,
      gallery_done: it.gallery_done,
      gallery_target: batch.gallery_target,
      persona_id: it.persona_id,
      display_name: it.display_name,
      age: it.age,
      city: it.city,
      occupation: it.occupation,
      avatar_url: it.real_avatar_url ?? it.avatar_url,
      profile_error: it.profile_error,
      photo_error: it.photo_error,
      gallery_error: it.gallery_error,
      warning: it.warning,
    })),
  };
}

export async function GET(_req: Request, ctx: RouteCtx) {
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

  const { data: batch, error } = await service
    .from("chat_persona_batches")
    .select("*")
    .eq("id", ctx.params.id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!batch) {
    return NextResponse.json({ error: "Batch niet gevonden." }, { status: 404 });
  }
  if ((batch as BatchRow).owner_user_id !== auth.userId) {
    return NextResponse.json({ error: "Geen toegang tot deze batch." }, { status: 403 });
  }

  const { data: items } = await service
    .from("chat_persona_batch_items")
    .select("*")
    .eq("batch_id", ctx.params.id)
    .order("idx", { ascending: true });

  return NextResponse.json({
    ok: true,
    batch: projectBatch(batch as BatchRow, (items ?? []) as BatchItemRow[]),
  });
}

/** Cancel a running batch. The worker checks `status` at the top of
 * every tick, so cancellation takes effect on the next pass — any
 * unit already mid-flight finishes (we don't kill diffusion calls). */
export async function DELETE(req: Request, ctx: RouteCtx) {
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

  const { data: batch, error } = await service
    .from("chat_persona_batches")
    .select("id, owner_user_id, status")
    .eq("id", ctx.params.id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!batch) {
    return NextResponse.json({ error: "Batch niet gevonden." }, { status: 404 });
  }
  if ((batch as { owner_user_id: string }).owner_user_id !== auth.userId) {
    return NextResponse.json({ error: "Geen toegang tot deze batch." }, { status: 403 });
  }
  if (batch.status === "done" || batch.status === "cancelled" || batch.status === "failed") {
    return NextResponse.json({ ok: true, status: batch.status });
  }

  const { error: updateErr } = await service
    .from("chat_persona_batches")
    .update({
      status: "cancelled",
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", ctx.params.id);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: "cancelled" });
}

/** Resume a stalled batch — manually retrigger a worker tick. Useful
 * after a deploy / cold start that interrupted the chain. */
export async function POST(req: Request, ctx: RouteCtx) {
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

  const { data: batch } = await service
    .from("chat_persona_batches")
    .select("id, owner_user_id, status")
    .eq("id", ctx.params.id)
    .maybeSingle();
  if (!batch) {
    return NextResponse.json({ error: "Batch niet gevonden." }, { status: 404 });
  }
  if ((batch as { owner_user_id: string }).owner_user_id !== auth.userId) {
    return NextResponse.json({ error: "Geen toegang tot deze batch." }, { status: 403 });
  }
  if (batch.status === "done" || batch.status === "cancelled" || batch.status === "failed") {
    return NextResponse.json({ ok: true, status: batch.status });
  }

  const baseUrl = resolveBaseUrl(req);
  await triggerNextTick(baseUrl, ctx.params.id);

  return NextResponse.json({ ok: true, resumed: true });
}
