import { NextResponse } from "next/server";
import { loadOperatorUserThreads } from "@/lib/operator/inbox-data";
import { requireOperatorApi } from "@/lib/operator/api-auth";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { ownerUserId: string } },
) {
  const auth = await requireOperatorApi();
  if (!auth.ok) return auth.response;

  const ownerUserId = params.ownerUserId?.trim();
  if (!ownerUserId) {
    return NextResponse.json(
      { ok: false, error: "user-id ontbreekt" },
      { status: 400 },
    );
  }

  try {
    const threads = await loadOperatorUserThreads(auth.service, ownerUserId);
    return NextResponse.json({ ok: true, threads });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
