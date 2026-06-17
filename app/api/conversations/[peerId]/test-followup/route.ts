import { NextResponse } from "next/server";
import {
  generatePeerReply,
  isPersistedPeerReply,
} from "@/lib/ai/generate-peer-reply";
import type { FollowUpKind } from "@/lib/ai/follow-up-reply";
import { messageRowToUi, type ChatMessageRow, type ChatProfileRow } from "@/lib/chat/map-rows";
import {
  applyChatProfileIdLookupFilter,
  isResolvableChatProfileRow,
} from "@/lib/catalog/profile-variant";
import { createClient } from "@/utils/supabase/server";
import { isManualOperatorMode } from "@/lib/manual-operator-mode";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VALID_KINDS: FollowUpKind[] = [
  "v2_open_followup",
  "spontaneous",
  "winback",
];

/**
 * Development only: generate one contextual follow-up immediately (no wait).
 * Remove before production if undesired — guarded by NODE_ENV.
 */
export async function POST(
  request: Request,
  { params }: { params: { peerId: string } },
) {
  if (isManualOperatorMode()) {
    return NextResponse.json(
      { ok: false, error: "MANUAL_OPERATOR_MODE: follow-up test disabled" },
      { status: 403 },
    );
  }
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      { ok: false, error: "Alleen beschikbaar in development" },
      { status: 403 },
    );
  }

  const peerId = params.peerId;
  let kind: FollowUpKind = "spontaneous";
  try {
    const body = (await request.json()) as { kind?: string };
    if (body?.kind && VALID_KINDS.includes(body.kind as FollowUpKind)) {
      kind = body.kind as FollowUpKind;
    }
  } catch {
    /* default kind */
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Niet geautoriseerd" }, { status: 401 });
  }

  let profileQuery = supabase.from("chat_profiles").select("*").eq("id", peerId);
  profileQuery = applyChatProfileIdLookupFilter(profileQuery);
  const { data: profile, error: pe } = await profileQuery.maybeSingle();

  if (pe || !profile || !isResolvableChatProfileRow(profile)) {
    return NextResponse.json({ ok: false, error: "Onbekende persoon" }, { status: 404 });
  }

  const p = profile as ChatProfileRow;
  if (!p.is_ai) {
    return NextResponse.json({ ok: false, error: "Geen AI-chat" }, { status: 400 });
  }

  const { data: historyRows, error: histErr } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("peer_id", peerId)
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: true });

  if (histErr || !historyRows?.length) {
    return NextResponse.json(
      { ok: false, error: histErr?.message ?? "Geen berichtgeschiedenis" },
      { status: 400 },
    );
  }

  const history = historyRows as ChatMessageRow[];
  const last = history[history.length - 1];
  if (kind === "v2_open_followup" && last?.sender !== "peer") {
    return NextResponse.json(
      {
        ok: false,
        error:
          "v2 follow-up test: laatste bericht moet van haar zijn (zij typte als laatste, jij antwoordde niet).",
      },
      { status: 400 },
    );
  }

  const result = await generatePeerReply(supabase, {
    profile: p,
    history,
    ownerUserId: user.id,
    peerId,
    options: { forceSingleMessage: true, pendingKind: kind },
  });

  if (!isPersistedPeerReply(result)) {
    return NextResponse.json(
      { ok: false, error: result.ok ? "Geen persisted reply" : result.error },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    kind,
    newPeerMessages: [messageRowToUi(result.assistantRow)],
  });
}
