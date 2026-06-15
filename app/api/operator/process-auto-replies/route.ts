import { NextResponse } from "next/server";
import { requireOperatorApi } from "@/lib/operator/api-auth";
import { processPendingOperatorAutoReplies } from "@/lib/operator/process-operator-auto-reply";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  const auth = await requireOperatorApi();
  if (!auth.ok) return auth.response;

  const result = await processPendingOperatorAutoReplies(auth.service, {
    limit: 2,
  });

  return NextResponse.json({
    ok: true,
    ...result,
  });
}
