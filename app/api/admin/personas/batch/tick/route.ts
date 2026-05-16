import { NextResponse } from "next/server";

import { getServiceSupabase } from "@/lib/supabase/admin";
import {
  resolveBaseUrl,
  runOneStep,
  scheduleAfterResponse,
  triggerNextTick,
  verifyWorkerToken,
} from "@/lib/admin/persona-batch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Worker tick. Acks immediately and runs the actual unit of work +
 * chain-trigger on the request's after-response lifetime (Vercel
 * waitUntil / inline await in dev). This pattern keeps each hop in
 * the chain to a <100ms ack, so a slow tick can't drag the previous
 * tick's function lifetime out and risk getting frozen mid-fetch.
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

  const baseUrl = resolveBaseUrl(req);

  // Schedule the actual work + chain-trigger AFTER the response is
  // sent. On Vercel this uses waitUntil so the function lifetime is
  // extended for the full maxDuration. Locally we just await inline.
  await scheduleAfterResponse(async () => {
    try {
      const result = await runOneStep(service, batchId);
      if (result.kind === "worked" && result.moreWork) {
        // Chain on. The next tick will also ack-fast so this await
        // resolves quickly even when the new tick has heavy work
        // queued behind its own waitUntil.
        await triggerNextTick(baseUrl, batchId);
      }
    } catch (err) {
      console.error("[persona-batch:tick] uncaught", {
        batchId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  return NextResponse.json({ ok: true, accepted: true });
}
