import { NextResponse } from "next/server";
import { decodeConversationId } from "@/lib/operator/conversation-key";
import { requireOperatorApi } from "@/lib/operator/api-auth";
import { generateOperatorReplySuggestions } from "@/lib/operator/generate-reply-suggestions";
import { logAiSuggestion } from "@/lib/operator/log";
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
  if (!lastUser) {
    return NextResponse.json(
      { ok: false, error: "Geen user-bericht om op te antwoorden" },
      { status: 400 },
    );
  }

  const result = await generateOperatorReplySuggestions({
    profile: profile as ChatProfileRow,
    history,
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
    suggestions: result.suggestions,
    suggestion: result.suggestions[0],
    triggerUserMessageId: lastUser.id,
    model: result.model,
    sentAutomatically: false,
  });
}
