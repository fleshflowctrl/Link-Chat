import { NextResponse } from "next/server";
import { cancelAllPendingAiGlobally } from "@/lib/operator/queue";
import { requireOperatorApi } from "@/lib/operator/api-auth";
import { isManualOperatorMode } from "@/lib/manual-operator-mode";

export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requireOperatorApi();
  if (!auth.ok) return auth.response;

  if (!isManualOperatorMode()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Zet MANUAL_OPERATOR_MODE=1 voordat je pending AI annuleert",
      },
      { status: 400 },
    );
  }

  const cancelled = await cancelAllPendingAiGlobally(auth.service);
  console.log("[manual-operator-mode] cancelled pending rows:", cancelled);

  return NextResponse.json({ ok: true, cancelled });
}
