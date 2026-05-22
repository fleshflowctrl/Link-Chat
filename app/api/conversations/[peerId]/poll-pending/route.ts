import { NextResponse } from "next/server";
import { messageRowToUi, type ChatProfileRow } from "@/lib/chat/map-rows";
import { processDuePendingReplies } from "@/lib/ai/pending-replies";
import { readServerAppVariant } from "@/lib/app-variant";
import {
  applyChatProfilesVariantFilter,
  chatProfileMatchesVariant,
} from "@/lib/catalog/profile-variant";
import { createClient } from "@/utils/supabase/server";
import { isManualOperatorMode } from "@/lib/manual-operator-mode";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Client-driven delivery endpoint for async-scheduled AI peer replies.
 *
 * The client sets a `setTimeout` based on the `nextPendingAt` it last saw and
 * fires this endpoint when the timer hits. We process any due pending rows
 * for this thread, return the new peer messages (typically one), and surface
 * the next still-pending scheduled_at so the client can re-arm its timer if
 * a queue has piled up (rare, but possible if user sent multiple messages).
 *
 * Response shape:
 *   { ok: true, newPeerMessages: ChatMessage[], nextPendingAt: string | null }
 *
 * Idempotent: if the timer fires twice, the second call sees no due rows.
 */
export async function POST(
  _request: Request,
  { params }: { params: { peerId: string } },
) {
  const peerId = params.peerId;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Niet geautoriseerd" }, { status: 401 });
  }

  const variant = await readServerAppVariant();
  let profileQuery = supabase.from("chat_profiles").select("*").eq("id", peerId);
  profileQuery = applyChatProfilesVariantFilter(profileQuery, variant);
  const { data: profile, error: pe } = await profileQuery.maybeSingle();

  if (pe || !profile || !chatProfileMatchesVariant(profile as ChatProfileRow, variant)) {
    return NextResponse.json({ ok: false, error: "Onbekende persoon" }, { status: 404 });
  }

  const p = profile as ChatProfileRow;
  if (!p.is_ai || isManualOperatorMode()) {
    return NextResponse.json({
      ok: true,
      newPeerMessages: [],
      nextPendingAt: null,
      manualOperatorMode: isManualOperatorMode(),
    });
  }

  try {
    const r = await processDuePendingReplies(supabase, {
      ownerUserId: user.id,
      peerId,
      profile: p,
    });
    return NextResponse.json({
      ok: true,
      newPeerMessages: r.newPeerMessages.map(messageRowToUi),
      nextPendingAt: r.nextPendingAt,
      hadDuePending: r.hadDuePending,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[poll-pending] failed", peerId, msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
