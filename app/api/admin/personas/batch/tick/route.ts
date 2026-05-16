import { NextResponse } from "next/server";

import { getServiceSupabase } from "@/lib/supabase/admin";
import {
  resolveBaseUrl,
  runOneStep,
  triggerNextTick,
  verifyWorkerToken,
} from "@/lib/admin/persona-batch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Worker tick. Processes ONE unit of work for the batch and, if more
 * work remains, fires off another /tick before returning so the chain
 * keeps running until the batch is done. Each unit (write profile,
 * regen avatar, append one gallery photo) stays inside 60s on its own.
 *
 * Authenticated via HMAC token derived from SUPABASE_SERVICE_ROLE_KEY —
 * see `workerToken()` in lib/admin/persona-batch.ts. */
export const maxDuration = 60;

type TickBody = { batchId?: string; token?: string };

export async function POST(req: Request) {
  let body: TickBody;
  try {
    body = (await req.json()) as TickBody;
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON." }, { status: 400 });
  }

  const batchId = (body.batchId ?? "").trim();
  const token = (body.token ?? "").trim();
  if (!batchId) {
    return NextResponse.json({ error: "batchId ontbreekt." }, { status: 400 });
  }
  if (!verifyWorkerToken(batchId, token)) {
    return NextResponse.json({ error: "Ongeldig token." }, { status: 401 });
  }

  const service = getServiceSupabase();
  if (!service) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY ontbreekt." },
      { status: 500 },
    );
  }

  const result = await runOneStep(service, batchId);

  if (result.kind === "missing-batch") {
    return NextResponse.json({ ok: false, error: "Batch niet gevonden." }, { status: 404 });
  }
  if (result.kind === "stopped") {
    return NextResponse.json({ ok: true, stopped: true, reason: result.reason });
  }
  if (result.kind === "waiting") {
    // Some earlier item is still in flight. Don't immediately chain to
    // another tick — that would busy-loop hitting `waiting` again. The
    // UI heartbeat (POST /batch/[id]) and Vercel cron sweep will wake
    // us back up once the in-flight unit either resolves or the stuck
    // recovery threshold fires.
    return NextResponse.json({ ok: true, waiting: true, reason: result.reason });
  }
  if (result.moreWork) {
    const baseUrl = resolveBaseUrl(req);
    await triggerNextTick(baseUrl, batchId);
  }

  return NextResponse.json({
    ok: true,
    moreWork: result.moreWork,
  });
}
