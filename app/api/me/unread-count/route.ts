import { NextResponse } from "next/server";
import { fetchUnreadInboxCountServer } from "@/lib/chat/server-data";

export const dynamic = "force-dynamic";

/**
 * Lightweight endpoint used by the bottom nav to keep the unread badge fresh
 * across pages without requiring a full-page navigation.
 */
export async function GET() {
  const count = await fetchUnreadInboxCountServer();
  return NextResponse.json({ ok: true, count });
}
