import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import {
  resolveBaseUrl,
  triggerNextTick,
} from "@/lib/admin/persona-batch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Start a server-side auto-generate batch.
 *
 * Inserts a row into `chat_persona_batches` plus N rows into
 * `chat_persona_batch_items`, then triggers the first worker tick before
 * returning the batchId. From here the client just polls
 * `GET /api/admin/personas/batch/{id}` — closing the tab doesn't stop
 * the run because the worker chains itself server-side. */
export const maxDuration = 30;

const MAX_BATCH = 10;
const MIN_BRIEF_LEN = 8;
const GALLERY_TARGET = 3;

type StartBody = {
  brief?: string;
  count?: number;
  with_photos?: boolean;
  attractiveness?: "striking" | "average" | "plain";
  body_type?: "slim" | "average" | "plus";
  age_min?: number;
  age_max?: number;
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

  let body: StartBody;
  try {
    body = (await req.json()) as StartBody;
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON." }, { status: 400 });
  }

  const brief = (body.brief ?? "").trim();
  if (brief.length < MIN_BRIEF_LEN) {
    return NextResponse.json(
      {
        error: `Briefing is te kort (min. ${MIN_BRIEF_LEN} tekens).`,
      },
      { status: 400 },
    );
  }
  const total = Math.max(
    1,
    Math.min(MAX_BATCH, Math.round(Number(body.count) || 1)),
  );
  const with_photos = body.with_photos !== false;
  const attractiveness =
    body.attractiveness === "striking" || body.attractiveness === "plain"
      ? body.attractiveness
      : "average";
  const body_type =
    body.body_type === "slim" || body.body_type === "plus"
      ? body.body_type
      : "average";
  const age_min = Math.max(
    18,
    Math.min(99, Math.round(Number(body.age_min) || 22)),
  );
  const age_max = Math.max(
    18,
    Math.min(99, Math.round(Number(body.age_max) || 30)),
  );
  const lo = Math.min(age_min, age_max);
  const hi = Math.max(age_min, age_max);

  const sceneOffset = Math.floor(Math.random() * 1000);

  const { data: insertedBatch, error: batchErr } = await service
    .from("chat_persona_batches")
    .insert({
      owner_user_id: auth.userId,
      status: "pending",
      brief,
      total,
      with_photos,
      attractiveness,
      body_type,
      age_min: lo,
      age_max: hi,
      gallery_target: with_photos ? GALLERY_TARGET : 0,
      scene_offset: sceneOffset,
      exclude_ids: [],
      exclude_names: [],
    })
    .select("id")
    .maybeSingle();
  if (batchErr || !insertedBatch?.id) {
    return NextResponse.json(
      { error: `Batch aanmaken faalde: ${batchErr?.message ?? "onbekend"}` },
      { status: 500 },
    );
  }

  const batchId = insertedBatch.id as string;

  const items = Array.from({ length: total }, (_, i) => ({
    batch_id: batchId,
    idx: i,
    profile_state: "pending" as const,
    photo_state: (with_photos ? "pending" : "skipped") as
      | "pending"
      | "skipped",
    gallery_state: (with_photos ? "pending" : "skipped") as
      | "pending"
      | "skipped",
    gallery_done: 0,
  }));
  const { error: itemsErr } = await service
    .from("chat_persona_batch_items")
    .insert(items);
  if (itemsErr) {
    return NextResponse.json(
      { error: `Items aanmaken faalde: ${itemsErr.message}` },
      { status: 500 },
    );
  }

  // Kick off the first tick. We don't await the full chain — the tick
  // endpoint will self-trigger as long as work remains. We do wait
  // briefly inside triggerNextTick so the request makes it out before
  // this function returns.
  const baseUrl = resolveBaseUrl(req);
  await triggerNextTick(baseUrl, batchId);

  return NextResponse.json(
    {
      ok: true,
      batch: {
        id: batchId,
        status: "running",
        total,
        with_photos,
        gallery_target: with_photos ? GALLERY_TARGET : 0,
      },
    },
    { status: 201 },
  );
}
