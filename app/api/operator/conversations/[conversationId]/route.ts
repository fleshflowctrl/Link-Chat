import { NextResponse } from "next/server";
import { decodeConversationId } from "@/lib/operator/conversation-key";
import { loadOperatorThreadDetail } from "@/lib/operator/inbox-data";
import { requireOperatorApi } from "@/lib/operator/api-auth";
import { messageRowToUi } from "@/lib/chat/map-rows";

export const dynamic = "force-dynamic";

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

  try {
    const detail = await loadOperatorThreadDetail(
      auth.service,
      decoded.ownerUserId,
      decoded.peerId,
    );
    if (!detail) {
      return NextResponse.json({ ok: false, error: "Niet gevonden" }, { status: 404 });
    }
    return NextResponse.json({
      ok: true,
      conversationId: detail.conversationId,
      ownerUserId: detail.ownerUserId,
      peerId: detail.peerId,
      ownerEmail: detail.ownerEmail,
      ownerDisplayName: detail.ownerDisplayName,
      ownerPhotoUrl: detail.ownerPhotoUrl,
      peer: detail.peer,
      queue: detail.queue,
      memorySummary: detail.memorySummary,
      messages: detail.messages.map(messageRowToUi),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
