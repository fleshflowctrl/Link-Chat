import { NextResponse } from "next/server";
import { decodeConversationId } from "@/lib/operator/conversation-key";
import { requireOperatorApi } from "@/lib/operator/api-auth";
import { logAiSuggestion } from "@/lib/operator/log";
import { generatePeerReplyDraftOnly } from "@/lib/ai/generate-peer-reply";
import type { ChatMessageRow, ChatProfileRow } from "@/lib/chat/map-rows";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(
  _request: Request,
  { params }: { params: { conversationId: string } },
) {
  const auth = await requireOperatorApi();
  if (!auth.ok) return auth.response;

  const decoded = decodeConversationId(params.conversationId);
  if (!decoded) {
    return NextResponse.json({ ok: false, error: "Ongeldig gesprek-id" }, { status: 400 });
  }

  const { data: profile, error: pe } = await auth.service
    .from("chat_profiles")
    .select("*")
    .eq("id", decoded.peerId)
    .maybeSingle();

  if (pe || !profile) {
    return NextResponse.json({ ok: false, error: "Peer niet gevonden" }, { status: 404 });
  }

  const { data: historyRows } = await auth.service
    .from("chat_messages")
    .select("*")
    .eq("owner_user_id", decoded.ownerUserId)
    .eq("peer_id", decoded.peerId)
    .order("created_at", { ascending: true });

  const history = (historyRows ?? []) as ChatMessageRow[];
  const lastUser = [...history].reverse().find((m) => m.sender === "me");

  const result = await generatePeerReplyDraftOnly(auth.service, {
    profile: profile as ChatProfileRow,
    history,
    ownerUserId: decoded.ownerUserId,
    peerId: decoded.peerId,
    options: { triggerUserMessageId: lastUser?.id },
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  logAiSuggestion({
    conversationId: params.conversationId,
    peerId: decoded.peerId,
    ownerUserId: decoded.ownerUserId,
    suggestionGenerated: true,
    sentAutomatically: false,
  });

  return NextResponse.json({
    ok: true,
    suggestion: result.draftText,
    sentAutomatically: false,
  });
}
