import { NextResponse } from "next/server";
import { decodeConversationId } from "@/lib/operator/conversation-key";
import {
  cancelPendingAiForThread,
  markOperatorReplied,
} from "@/lib/operator/queue";
import { requireOperatorApi } from "@/lib/operator/api-auth";
import { logOperatorReply } from "@/lib/operator/log";
import { messageRowToUi } from "@/lib/chat/map-rows";
import type { ChatMessageRow } from "@/lib/chat/map-rows";

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
  if (!text || text.length > 4000) {
    return NextResponse.json({ ok: false, error: "Tekst ontbreekt of te lang" }, { status: 400 });
  }
  if (body.peerId && body.peerId !== decoded.peerId) {
    return NextResponse.json({ ok: false, error: "peerId komt niet overeen" }, { status: 400 });
  }

  const { data: inserted, error: insErr } = await auth.service
    .from("chat_messages")
    .insert({
      peer_id: decoded.peerId,
      owner_user_id: decoded.ownerUserId,
      sender: "peer",
      kind: "text",
      body: text,
      message_source: "operator_manual",
    })
    .select("*")
    .single();

  if (insErr || !inserted) {
    return NextResponse.json(
      { ok: false, error: insErr?.message ?? "Insert mislukt" },
      { status: 500 },
    );
  }

  await cancelPendingAiForThread(
    auth.service,
    decoded.ownerUserId,
    decoded.peerId,
  );
  await markOperatorReplied(auth.service, {
    ownerUserId: decoded.ownerUserId,
    peerId: decoded.peerId,
    operatorId: auth.operatorId,
  });

  logOperatorReply({
    conversationId: params.conversationId,
    peerId: decoded.peerId,
    ownerUserId: decoded.ownerUserId,
    operatorId: auth.operatorId,
    messageInserted: true,
  });

  return NextResponse.json({
    ok: true,
    peerMessage: messageRowToUi(inserted as ChatMessageRow),
  });
}
