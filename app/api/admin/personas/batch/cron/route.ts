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
 * Auth: Vercel cron sets `Authorization: Bearer <CRON_SECRET>` when
 * `CRON_SECRET` is configured. We require that header. If you forget
 * to set it the cron route will refuse — the chain still works for
 * happy-path batches via the inline triggerNextTick, you just lose
 * the recovery loop.
 */
export async function GET(req: Request) {
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET ontbreekt." },
      { status: 503 },
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
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
  const baseUrl = resolveBaseUrl(req);
  await Promise.all(ids.map((id) => triggerNextTick(baseUrl, id).catch(() => null)));

  return NextResponse.json({ ok: true, woke: ids.length });
}
