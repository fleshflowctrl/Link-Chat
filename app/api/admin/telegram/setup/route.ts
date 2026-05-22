import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  getTelegramBotToken,
  getTelegramOperatorChatIds,
  getTelegramWebhookSecret,
  getTelegramWebhookUrl,
  isTelegramOperatorEnabled,
} from "@/lib/telegram/config";
import {
  telegramDeleteWebhook,
  telegramGetWebhookInfo,
  telegramSetWebhook,
} from "@/lib/telegram/bot-api";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const token = getTelegramBotToken();
  if (!token) {
    return NextResponse.json({
      ok: true,
      configured: false,
      error: "TELEGRAM_BOT_TOKEN ontbreekt in env",
    });
  }

  const info = await telegramGetWebhookInfo();
  return NextResponse.json({
    ok: true,
    configured: isTelegramOperatorEnabled(),
    operatorChatIds: getTelegramOperatorChatIds(),
    webhookUrl: getTelegramWebhookUrl(),
    hasWebhookSecret: Boolean(getTelegramWebhookSecret()),
    webhook: info.ok ? info.result : null,
    webhookError: info.ok ? null : info.description,
  });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const token = getTelegramBotToken();
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "TELEGRAM_BOT_TOKEN ontbreekt" },
      { status: 400 },
    );
  }

  let action: "set" | "delete" = "set";
  try {
    const body = (await request.json()) as { action?: string };
    if (body.action === "delete") action = "delete";
  } catch {
    /* default set */
  }

  if (action === "delete") {
    const del = await telegramDeleteWebhook();
    return NextResponse.json({
      ok: del.ok,
      action: "delete",
      error: del.ok ? null : del.description,
    });
  }

  const secret = getTelegramWebhookSecret();
  const set = await telegramSetWebhook({
    url: getTelegramWebhookUrl(),
    secretToken: secret ?? undefined,
  });

  return NextResponse.json({
    ok: set.ok,
    action: "set",
    webhookUrl: getTelegramWebhookUrl(),
    error: set.ok ? null : set.description,
  });
}
