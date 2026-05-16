import { NextResponse } from "next/server";
import { DEFAULT_PHOTO_UNLOCK_COST_CREDITS } from "@/lib/credits/pricing";
import { createClient } from "@/utils/supabase/server";

/**
 * POST /api/chat/unlock-photo
 * Body: { messageId: string }
 *
 * Deducts credits (blur_cost on the message, or default) and records
 * the unlock in chat_photo_unlocks. Idempotent — if already unlocked,
 * returns success without deducting again.
 */
export async function POST(req: Request) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Niet geautoriseerd" }, { status: 401 });
  }

  let body: { messageId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldige body" }, { status: 400 });
  }

  const messageId = body.messageId?.trim();
  if (!messageId) {
    return NextResponse.json({ ok: false, error: "messageId ontbreekt" }, { status: 400 });
  }

  // 1. Load the message and its blur cost
  const { data: msg, error: msgErr } = await supabase
    .from("chat_messages")
    .select("id, owner_user_id, blur_cost, kind")
    .eq("id", messageId)
    .maybeSingle();

  if (msgErr || !msg) {
    return NextResponse.json({ ok: false, error: "Bericht niet gevonden" }, { status: 404 });
  }

  const blurCost = typeof (msg as any).blur_cost === "number" ? (msg as any).blur_cost : 0;
  if (blurCost <= 0) {
    return NextResponse.json({ ok: true, alreadyUnlocked: true });
  }

  // 2. Check if already unlocked by this user
  const { data: existing } = await supabase
    .from("chat_photo_unlocks")
    .select("message_id")
    .eq("owner_user_id", user.id)
    .eq("message_id", messageId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, alreadyUnlocked: true });
  }

  // 3. Check user credits — user_profiles uses user_id as PK (not id)
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("credits")
    .eq("user_id", user.id)
    .maybeSingle();

  const currentCredits = (profile as any)?.credits ?? 0;
  if (currentCredits < blurCost) {
    return NextResponse.json(
      { ok: false, error: `Niet genoeg credits (heb ${currentCredits}, nodig ${blurCost})` },
      { status: 402 },
    );
  }

  // 4. Deduct credits + insert unlock (transaction-like with two updates)
  const { error: deductErr } = await supabase
    .from("user_profiles")
    .update({ credits: currentCredits - blurCost })
    .eq("user_id", user.id);

  if (deductErr) {
    return NextResponse.json({ ok: false, error: "Credits aftrekken mislukt" }, { status: 500 });
  }

  const { error: unlockErr } = await supabase.from("chat_photo_unlocks").insert({
    owner_user_id: user.id,
    message_id: messageId,
    credits_paid: blurCost,
  });

  if (unlockErr) {
    // Best-effort refund (non-critical)
    await supabase
      .from("user_profiles")
      .update({ credits: currentCredits })
      .eq("user_id", user.id);
    return NextResponse.json({ ok: false, error: "Unlock opslaan mislukt" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, unlocked: true, creditsSpent: blurCost });
}
