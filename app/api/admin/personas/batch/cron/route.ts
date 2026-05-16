import { NextResponse } from "next/server";

import { getServiceSupabase } from "@/lib/supabase/admin";
import {
  resolveBaseUrl,
  triggerNextTick,
} from "@/lib/admin/persona-batch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Watchdog cron route.
 *
 * Vercel cron pings this every minute (see vercel.json). For each active
 * batch (status pending/running) we fire one worker tick. The tick is
 * a no-op when an item is already in flight (returns "waiting"), and
 * resets any item that's been stuck longer than 90s before picking the
 * next unit. This is the safety net that keeps batches moving even
 * when the chained-fetch worker dies mid-call AND the operator has
 * closed the admin tab so the UI heartbeat can't help.
 *
 * Auth model:
 *   - If `CRON_SECRET` is set we require `Authorization: Bearer <secret>`
 *     (matching what Vercel cron sends automatically).
 *   - Otherwise the endpoint is open. It only triggers worker ticks
 *     for batches that already exist in the DB, so the worst an
 *     unauthenticated caller can do is replay work that was already
 *     queued — the worker is idempotent and the HF Space rate-limits
 *     itself.
 *   - We also accept a `?key=<value>` query param matching `CRON_SECRET`,
 *     so an operator can hit the endpoint from a browser when they
 *     need to manually kick a batch.
 */
export async function GET(req: Request) {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (secret) {
    const auth = req.headers.get("authorization") ?? "";
    const url = new URL(req.url);
    const queryKey = url.searchParams.get("key") ?? "";
    const headerOk = auth === `Bearer ${secret}`;
    const queryOk = queryKey === secret;
    if (!headerOk && !queryOk) {
      console.warn("[persona-batch:cron] rejected", {
        hasSecret: true,
        authHeaderPresent: auth.length > 0,
        queryKeyPresent: queryKey.length > 0,
      });
      return NextResponse.json(
        { ok: false, error: "Unauthorized." },
        { status: 401 },
      );
    }
  }

  const service = getServiceSupabase();
  if (!service) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY ontbreekt." },
      { status: 500 },
    );
  }

  const { data, error } = await service
    .from("chat_persona_batches")
    .select("id")
    .in("status", ["pending", "running"]);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const ids = ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
  console.log("[persona-batch:cron] sweep", { active: ids.length });
  const baseUrl = resolveBaseUrl(req);
  await Promise.all(ids.map((id) => triggerNextTick(baseUrl, id).catch(() => null)));

  return NextResponse.json({ ok: true, woke: ids.length });
}
