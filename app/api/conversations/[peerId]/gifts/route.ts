import { NextResponse } from "next/server";
import { readServerAppVariant } from "@/lib/app-variant";
import {
  applyChatProfilesVariantFilter,
  chatProfileMatchesVariant,
} from "@/lib/catalog/profile-variant";
import type { ChatProfileRow } from "@/lib/chat/map-rows";
import { messageRowToUi, type ChatMessageRow } from "@/lib/chat/map-rows";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

const MIN_GIFT = 1;
const MAX_GIFT = 10_000;

/**
 * Send a credit gift to a chat peer.
 *
 * Atomically (best-effort, two writes):
 *   1. Deduct `amount` from the sender's `user_profiles.credits`.
 *   2. Insert a `chat_messages` row with `kind = 'gift'` and `gift_credits = amount`.
 *
 * If the credit deduction fails (insufficient balance, no profile row, etc.) we
 * never insert the message, so the transcript only contains gifts that were
 * actually paid for.
 */
export async function POST(
  request: Request,
  { params }: { params: { peerId: string } },
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Ongeldige JSON" },
      { status: 400 },
    );
  }

  const obj = (body && typeof body === "object" ? body : {}) as Record<
    string,
    unknown
  >;
  const amount =
    typeof obj.amount === "number" && Number.isFinite(obj.amount)
      ? Math.floor(obj.amount)
      : NaN;

  if (!Number.isFinite(amount) || amount < MIN_GIFT || amount > MAX_GIFT) {
    return NextResponse.json(
      {
        ok: false,
        error: `Bedrag moet tussen ${MIN_GIFT} en ${MAX_GIFT} credits zijn`,
      },
      { status: 400 },
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Niet geautoriseerd" },
      { status: 401 },
    );
  }

  const peerId = params.peerId;

  const variant = await readServerAppVariant();
  let profileQuery = supabase
    .from("chat_profiles")
    .select("id, display_name, app_variant")
    .eq("id", peerId);
  profileQuery = applyChatProfilesVariantFilter(profileQuery, variant);
  const { data: profile, error: pe } = await profileQuery.maybeSingle();

  if (pe || !profile || !chatProfileMatchesVariant(profile as ChatProfileRow, variant)) {
    return NextResponse.json(
      { ok: false, error: "Onbekende persoon" },
      { status: 404 },
    );
  }

  const { data: profileRow, error: prErr } = await supabase
    .from("user_profiles")
    .select("credits")
    .eq("user_id", user.id)
    .maybeSingle();

  if (prErr) {
    return NextResponse.json(
      { ok: false, error: prErr.message },
      { status: 500 },
    );
  }

  const currentCredits =
    profileRow && typeof (profileRow as { credits?: number }).credits === "number"
      ? Math.max(0, (profileRow as { credits: number }).credits)
      : 0;

  if (currentCredits < amount) {
    return NextResponse.json(
      {
        ok: false,
        error: `Niet genoeg credits (heb je er ${currentCredits}, nodig ${amount})`,
        currentBalance: currentCredits,
      },
      { status: 402 },
    );
  }

  const newBalance = currentCredits - amount;

  const { error: updErr } = await supabase
    .from("user_profiles")
    .update({ credits: newBalance, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);

  if (updErr) {
    return NextResponse.json(
      { ok: false, error: updErr.message },
      { status: 500 },
    );
  }

  const peerName =
    (profile as { display_name?: string }).display_name ?? "haar";
  const giftBody = `🎁 Cadeau voor ${peerName}: ${amount} credits`;

  const { data: insertedRow, error: ie } = await supabase
    .from("chat_messages")
    .insert({
      peer_id: peerId,
      sender: "me",
      kind: "gift",
      body: giftBody,
      gift_credits: amount,
      owner_user_id: user.id,
    })
    .select("*")
    .single();

  if (ie || !insertedRow) {
    // Refund — message wasn't stored, give the credits back.
    await supabase
      .from("user_profiles")
      .update({ credits: currentCredits, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);

    return NextResponse.json(
      {
        ok: false,
        error: ie?.message ?? "Cadeau opslaan mislukt",
      },
      { status: 500 },
    );
  }

  const userMessage = messageRowToUi(insertedRow as ChatMessageRow);

  return NextResponse.json({
    ok: true,
    userMessage,
    peerMessage: null,
    newBalance,
  });
}
