import { NextResponse } from "next/server";
import {
  discoveryPrefsToJson,
  funnelInputToDiscoveryPrefs,
} from "@/lib/discovery-preferences-server";
import type { FunnelAgeRange, FunnelLookingFor } from "@/data/funnel";
import type {
  FunnelGender,
  FunnelSeekingGender,
} from "@/lib/funnel/save-funnel-account";
import {
  CHAT_MESSAGE_COST_CREDITS,
  STARTING_USER_CREDITS,
} from "@/lib/credits/pricing";
import { deductUserCredits, refundUserCredits } from "@/lib/credits/deduct";
import { createClient } from "@/utils/supabase/server";
import { isSupabaseConfigured } from "@/utils/supabase/public-env";

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

type Body = {
  lookingFor?: FunnelLookingFor | null;
  gender?: FunnelGender | null;
  seekingGender?: FunnelSeekingGender | null;
  ageRange?: FunnelAgeRange;
  startingCredits?: number;
  pickedMatchId?: string | null;
  firstMessage?: string | null;
};

/**
 * Apply funnel demographics saved client-side while waiting for email
 * confirmation (no session at signup time).
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return bad("Ongeldige JSON");
  }

  let supabase: ReturnType<typeof createClient>;
  try {
    supabase = createClient();
  } catch {
    return bad("Server verkeerd geconfigureerd", 503);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return bad("Niet geautoriseerd", 401);

  const ageRange = body.ageRange ?? { min: 18, max: 35, anyAge: false };
  const prefs = funnelInputToDiscoveryPrefs({
    lookingFor: body.lookingFor ?? null,
    seekingGender: body.seekingGender ?? null,
    ageRange,
  });

  const { data: existing } = await supabase
    .from("user_profiles")
    .select("credits, looking_for")
    .eq("user_id", user.id)
    .maybeSingle();

  const creditsKeep =
    typeof existing?.credits === "number" && existing.credits >= 0
      ? existing.credits
      : Math.max(0, Math.floor(body.startingCredits ?? STARTING_USER_CREDITS));

  const shouldWriteDemographics = !(existing?.looking_for ?? "").trim();

  const patch: Record<string, unknown> = {
    discovery_prefs: discoveryPrefsToJson(prefs),
    updated_at: new Date().toISOString(),
  };

  if (shouldWriteDemographics) {
    patch.looking_for = body.lookingFor ?? "";
    patch.gender = body.gender ?? "";
    patch.seeking_gender = body.seekingGender ?? "";
    patch.age_range_min = ageRange.anyAge ? 18 : ageRange.min;
    patch.age_range_max = ageRange.anyAge ? 99 : ageRange.max;
    patch.age_range_any = ageRange.anyAge;
    patch.credits = creditsKeep;
  }

  const { error: upsertError } = await supabase
    .from("user_profiles")
    .upsert({ user_id: user.id, ...patch }, { onConflict: "user_id" });

  if (upsertError) {
    console.error("[POST /api/me/funnel-sync]", upsertError);
    return bad("Profiel sync mislukt", 500);
  }

  const firstMessage = (body.firstMessage ?? "").trim();
  const peerId = (body.pickedMatchId ?? "").trim();
  if (firstMessage && peerId && shouldWriteDemographics) {
    const { data: existingMsg } = await supabase
      .from("chat_messages")
      .select("id")
      .eq("owner_user_id", user.id)
      .eq("peer_id", peerId)
      .eq("sender", "me")
      .limit(1)
      .maybeSingle();

    if (!existingMsg) {
      const deduct = await deductUserCredits(
        supabase,
        user.id,
        CHAT_MESSAGE_COST_CREDITS,
      );
      if (!deduct.ok) {
        return bad(
          deduct.reason === "insufficient"
            ? `Niet genoeg credits voor je eerste bericht (${CHAT_MESSAGE_COST_CREDITS} nodig)`
            : deduct.error ?? "Credits aftrekken mislukt",
          deduct.reason === "insufficient" ? 402 : 500,
        );
      }
      const { error: msgErr } = await supabase.from("chat_messages").insert({
        peer_id: peerId,
        sender: "me",
        kind: "text",
        body: firstMessage,
        owner_user_id: user.id,
      });
      if (msgErr) {
        await refundUserCredits(supabase, user.id, deduct.balanceBefore);
        return bad("Eerste bericht opslaan mislukt", 500);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
