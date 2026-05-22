import { NextResponse } from "next/server";
import { decodeConversationId } from "@/lib/operator/conversation-key";
import { requireOperatorApi } from "@/lib/operator/api-auth";
import { sendOperatorPeerReply } from "@/lib/operator/send-peer-reply";

export const dynamic = "force-dynamic";

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

  let body: { body?: string; peerId?: string };
  try {
    body = (await request.json()) as { body?: string; peerId?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige JSON" }, { status: 400 });
  }

  const text = (body.body ?? "").trim();
  if (body.peerId && body.peerId !== decoded.peerId) {
    return NextResponse.json({ ok: false, error: "peerId komt niet overeen" }, { status: 400 });
  }

  const result = await sendOperatorPeerReply(auth.service, {
    ownerUserId: decoded.ownerUserId,
    peerId: decoded.peerId,
    text,
    operatorId: auth.operatorId,
    source: "operator_manual",
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status ?? 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    peerMessage: result.peerMessage,
  });
}
