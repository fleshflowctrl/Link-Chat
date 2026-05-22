import { NextResponse } from "next/server";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { getTelegramWebhookSecret } from "@/lib/telegram/config";
import { handleTelegramUpdate, type TelegramUpdate } from "@/lib/telegram/handle-update";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = getTelegramWebhookSecret();
  if (secret) {
    const header = request.headers.get("x-telegram-bot-api-secret-token");
    if (header !== secret) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  const service = getServiceSupabase();
  if (!service) {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  try {
    await handleTelegramUpdate(service, update);
  } catch (e) {
    console.error("[telegram/webhook]", e);
  }

  return NextResponse.json({ ok: true });
}
