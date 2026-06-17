import { NextResponse } from "next/server";

import { isManualOperatorMode } from "@/lib/manual-operator-mode";
import { processPendingOperatorAutoReplies } from "@/lib/operator/process-operator-auto-reply";
import { getServiceSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Vercel cron (every minute): send operator AI auto-replies even when the
 * inbox tab is closed. Requires MANUAL_OPERATOR_MODE and ai_auto_reply_enabled.
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

  if (!isManualOperatorMode()) {
    return NextResponse.json({ ok: true, skipped: "manual_operator_mode_off" });
  }

  const service = getServiceSupabase();
  if (!service) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY ontbreekt." },
      { status: 500 },
    );
  }

  const result = await processPendingOperatorAutoReplies(service, {
    limit: 12,
    maxBatches: 8,
  });
  console.log("[cron/operator-auto-replies]", result);

  return NextResponse.json({ ok: true, ...result });
}
