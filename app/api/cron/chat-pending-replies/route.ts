import { NextResponse } from "next/server";

import { processAllDuePendingGlobally } from "@/lib/ai/process-pending-for-owner";
import { getServiceSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Vercel cron (every minute): deliver due AI replies even when no client
 * is open. Requires SUPABASE_SERVICE_ROLE_KEY.
 */
function isAuthorizedCron(req: Request): boolean {
  if (req.headers.get("x-vercel-cron") === "1") return true;
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (!secret) return true;
  const auth = req.headers.get("authorization") ?? "";
  const url = new URL(req.url);
  const queryKey = url.searchParams.get("key") ?? "";
  return auth === `Bearer ${secret}` || queryKey === secret;
}

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }

  const service = getServiceSupabase();
  if (!service) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY ontbreekt." },
      { status: 500 },
    );
  }

  const result = await processAllDuePendingGlobally(service, {
    maxThreadsPerBatch: 16,
    timeBudgetMs: 100_000,
  });
  console.log("[cron/chat-pending-replies]", result);

  return NextResponse.json({ ok: true, ...result });
}
