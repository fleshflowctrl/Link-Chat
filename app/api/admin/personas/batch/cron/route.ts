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
 *     (matching what Vercel cron sends automatically when the env var
 *     exists on the project).
 *   - If `CRON_SECRET` is not configured we still accept Vercel cron
 *     pings (identified by Vercel's own `x-vercel-cron` header) and
 *     same-origin requests. The endpoint is functionally idempotent
 *     and can only trigger work that's already queued, so the worst
 *     an unauthenticated caller can do is accelerate an existing run.
 */
export async function GET(req: Request) {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  const auth = req.headers.get("authorization") ?? "";
  const isVercelCron = req.headers.get("x-vercel-cron") != null;
  let authorized = false;
  if (secret) {
    authorized = auth === `Bearer ${secret}`;
  } else {
    // No secret configured — trust Vercel's cron header. This keeps the
    // chain healing out-of-the-box; operators who care can set
    // CRON_SECRET to lock it down.
    authorized = isVercelCron;
  }
  if (!authorized) {
    console.warn("[persona-batch:cron] rejected", {
      hasSecret: Boolean(secret),
      isVercelCron,
      authHeaderPresent: auth.length > 0,
    });
    return NextResponse.json(
      { ok: false, error: secret ? "Unauthorized." : "Cron header ontbreekt." },
      { status: 401 },
    );
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
