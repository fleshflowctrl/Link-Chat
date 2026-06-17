import { NextResponse } from "next/server";
import {
  getOperatorAppSettings,
  setOperatorAiAutoReplyEnabled,
} from "@/lib/operator/ai-auto-settings";
import { requireOperatorApi } from "@/lib/operator/api-auth";
import {
  processPendingOperatorAutoReplies,
  resetStuckOperatorAutoReplyClaims,
} from "@/lib/operator/process-operator-auto-reply";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireOperatorApi();
  if (!auth.ok) return auth.response;

  const settings = await getOperatorAppSettings(auth.service);
  return NextResponse.json({
    ok: true,
    aiAutoReplyEnabled: settings.aiAutoReplyEnabled,
    updatedAt: settings.updatedAt,
  });
}

export async function PATCH(request: Request) {
  const auth = await requireOperatorApi();
  if (!auth.ok) return auth.response;

  let body: { aiAutoReplyEnabled?: boolean };
  try {
    body = (await request.json()) as { aiAutoReplyEnabled?: boolean };
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige JSON" }, { status: 400 });
  }

  if (typeof body.aiAutoReplyEnabled !== "boolean") {
    return NextResponse.json(
      { ok: false, error: "aiAutoReplyEnabled verplicht" },
      { status: 400 },
    );
  }

  try {
    const settings = await setOperatorAiAutoReplyEnabled(
      auth.service,
      body.aiAutoReplyEnabled,
      auth.operatorId,
    );

    let stuckClaimsReset = 0;
    if (body.aiAutoReplyEnabled) {
      stuckClaimsReset = await resetStuckOperatorAutoReplyClaims(auth.service, {
        forceAll: true,
      });
      void processPendingOperatorAutoReplies(auth.service, {
        limit: 8,
        maxBatches: 6,
      }).catch((e) => {
        console.warn("[operator-auto-reply] kickoff after enable", e);
      });
    }

    return NextResponse.json({
      ok: true,
      aiAutoReplyEnabled: settings.aiAutoReplyEnabled,
      updatedAt: settings.updatedAt,
      stuckClaimsReset,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
