import { NextResponse } from "next/server";
import type { ChatProfileRow } from "@/lib/chat/map-rows";
import { scheduleV2OpenFollowup } from "@/lib/ai/v2-open-followup";
import { schedulePendingReplyDelivery } from "@/lib/ai/schedule-pending-reply-delivery";
import { readServerAppVariant } from "@/lib/app-variant";
import {
  applyChatProfilesVariantFilter,
  chatProfileMatchesVariant,
} from "@/lib/catalog/profile-variant";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

/**
 * v2 only: arm a 5-minute follow-up when the user opens chat on the bot's last
 * bubble without replying.
 */
export async function POST(
  _request: Request,
  { params }: { params: { peerId: string } },
) {
  const variant = await readServerAppVariant();
  if (variant !== "v2") {
    return NextResponse.json({ ok: true, skipped: true, nextPendingAt: null });
  }

  const peerId = params.peerId;
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Niet geautoriseerd" }, { status: 401 });
  }

  let profileQuery = supabase.from("chat_profiles").select("*").eq("id", peerId);
  profileQuery = applyChatProfilesVariantFilter(profileQuery, "v2");
  const { data: profile, error: pe } = await profileQuery.maybeSingle();

  if (pe || !profile || !chatProfileMatchesVariant(profile as ChatProfileRow, "v2")) {
    return NextResponse.json({ ok: false, error: "Onbekende persoon" }, { status: 404 });
  }

  const p = profile as ChatProfileRow;
  if (!p.is_ai) {
    return NextResponse.json({ ok: true, skipped: true, nextPendingAt: null });
  }

  const scheduledAt = await scheduleV2OpenFollowup(supabase, {
    ownerUserId: user.id,
    peerId,
  });

  if (scheduledAt) {
    schedulePendingReplyDelivery({
      ownerUserId: user.id,
      peerId,
      profile: p,
      scheduledAtIso: scheduledAt,
    });
  }

  return NextResponse.json({
    ok: true,
    nextPendingAt: scheduledAt,
  });
}
