import { NextResponse } from "next/server";
import { loadOperatorInbox } from "@/lib/operator/inbox-data";
import { requireOperatorApi } from "@/lib/operator/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireOperatorApi();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? undefined;

  try {
    const items = await loadOperatorInbox(auth.service, { status });
    return NextResponse.json({ ok: true, conversations: items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
