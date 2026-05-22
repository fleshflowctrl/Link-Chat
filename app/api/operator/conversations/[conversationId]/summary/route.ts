import { NextResponse } from "next/server";
import { decodeConversationId } from "@/lib/operator/conversation-key";
import { requireOperatorApi } from "@/lib/operator/api-auth";
import { generateOperatorThreadSummary } from "@/lib/operator/generate-thread-summary";
import { loadOperatorSummaryContext } from "@/lib/operator/load-summary-context";
import {
  getSavedOperatorSummary,
  saveSavedOperatorSummary,
} from "@/lib/operator/saved-summary";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function jsonCached(
  saved: { summary: string; messageCount: number; generatedAt: string },
  cached: true,
) {
  return NextResponse.json({
    ok: true,
    summary: saved.summary,
    messageCount: saved.messageCount,
    generatedAt: saved.generatedAt,
    cached,
  });
}

/** Return saved summary if it exists (no Grok). */
export async function GET(
  _request: Request,
  { params }: { params: { conversationId: string } },
) {
  const auth = await requireOperatorApi();
  if (!auth.ok) return auth.response;

  const decoded = decodeConversationId(params.conversationId);
  if (!decoded) {
    return NextResponse.json({ ok: false, error: "Ongeldig gesprek-id" }, { status: 400 });
  }

  const saved = await getSavedOperatorSummary(
    auth.service,
    decoded.ownerUserId,
    decoded.peerId,
  );

  if (!saved) {
    return NextResponse.json({
      ok: true,
      summary: null,
      cached: false,
    });
  }

  return jsonCached(saved, true);
}

/** Generate with Grok only when refresh=true or no saved summary yet. */
export async function POST(
  request: Request,
  { params }: { params: { conversationId: string } },
) {
  const auth = await requireOperatorApi();
  if (!auth.ok) return auth.response;

  const decoded = decodeConversationId(params.conversationId);
  if (!decoded) {
    return NextResponse.json({ ok: false, error: "Ongeldig gesprek-id" }, { status: 400 });
  }

  let refresh = false;
  try {
    const body = (await request.json()) as { refresh?: boolean };
    refresh = body.refresh === true;
  } catch {
    /* empty body: use cached if present */
  }

  if (!refresh) {
    const saved = await getSavedOperatorSummary(
      auth.service,
      decoded.ownerUserId,
      decoded.peerId,
    );
    if (saved) {
      return jsonCached(saved, true);
    }
  }

  const ctx = await loadOperatorSummaryContext(
    auth.service,
    decoded.ownerUserId,
    decoded.peerId,
  );
  if (!ctx) {
    return NextResponse.json({ ok: false, error: "Gesprek niet gevonden" }, { status: 404 });
  }

  const result = await generateOperatorThreadSummary(ctx);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  await saveSavedOperatorSummary(auth.service, {
    ownerUserId: decoded.ownerUserId,
    peerId: decoded.peerId,
    summary: result.summary,
    messageCount: ctx.messages.length,
  });

  console.info("[operator-summary]", {
    conversationId: params.conversationId,
    ownerUserId: decoded.ownerUserId,
    peerId: decoded.peerId,
    messageCount: ctx.messages.length,
    refresh,
  });

  const saved = await getSavedOperatorSummary(
    auth.service,
    decoded.ownerUserId,
    decoded.peerId,
  );

  return NextResponse.json({
    ok: true,
    summary: result.summary,
    messageCount: ctx.messages.length,
    generatedAt: saved?.generatedAt ?? new Date().toISOString(),
    cached: false,
  });
}
