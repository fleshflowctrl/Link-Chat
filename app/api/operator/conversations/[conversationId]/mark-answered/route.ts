import { NextResponse } from "next/server";
import { decodeConversationId } from "@/lib/operator/conversation-key";
import { markOperatorAnswered } from "@/lib/operator/queue";
import { requireOperatorApi } from "@/lib/operator/api-auth";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: { conversationId: string } },
) {
  const auth = await requireOperatorApi();
  if (!auth.ok) return auth.response;

  const decoded = decodeConversationId(params.conversationId);
  if (!decoded) {
    return NextResponse.json(
      { ok: false, error: "Ongeldig gesprek-id" },
      { status: 400 },
    );
  }

  await markOperatorAnswered(auth.service, {
    ownerUserId: decoded.ownerUserId,
    peerId: decoded.peerId,
    operatorId: auth.operatorId,
  });

  return NextResponse.json({ ok: true, status: "answered" });
}
