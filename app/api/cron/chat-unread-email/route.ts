import { NextResponse } from "next/server";
import { processDueUnreadEmailNotifications } from "@/lib/chat/process-unread-email-notifications";
import { getServiceSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorizedCron(req: Request): boolean {
  if (req.headers.get("x-vercel-cron") === "1") return true;
  const secret = (process.env.CRON_SECRET ?? "").trim();
  if (!secret) return true;
  const auth = req.headers.get("authorization") ?? "";
  const url = new URL(req.url);
  const queryKey = url.searchParams.get("key") ?? "";
  return auth === `Bearer ${secret}` || queryKey === secret;
}

/**
 * Vercel cron: send Postmark reminders for peer messages unread ≥ 5 minutes.
 */
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

  const result = await processDueUnreadEmailNotifications(service);
  console.log("[cron/chat-unread-email]", result);

  return NextResponse.json({ ok: true, ...result });
}
