import { NextResponse } from "next/server";
import { contentSets } from "@/data/exclusive-content";
import { createClient } from "@/utils/supabase/server";
import { isSupabaseConfigured } from "@/utils/supabase/public-env";

export const dynamic = "force-dynamic";

/**
 * Returns the set IDs this signed-in user has unlocked.
 *
 * Anonymous (logged-out) users get an empty array — local-only browsing
 * doesn't carry persistent ownership.
 */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, setIds: [], anonymous: true });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: true, setIds: [], anonymous: true });
  }

  const { data, error } = await supabase
    .from("user_content_unlocks")
    .select("set_id")
    .eq("owner_user_id", user.id);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    setIds: (data ?? []).map((r) => r.set_id as string),
  });
}

/**
 * Atomically deduct the unlock cost from `user_profiles.credits` and record
 * the unlock in `user_content_unlocks`. Returns the new credit balance + the
 * full unlocked-set list so the client can sync without a follow-up GET.
 *
 * - 401 if not signed in.
 * - 404 if the set doesn't exist.
 * - 402 if not enough credits.
 * - 200 (idempotent) if the user already owns this set.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }

  const obj = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const setId = typeof obj.setId === "string" ? obj.setId.trim() : "";
  if (!setId) {
    return NextResponse.json({ ok: false, error: "missing setId" }, { status: 400 });
  }

  const set = contentSets.find((s) => s.id === setId);
  if (!set) {
    return NextResponse.json({ ok: false, error: "unknown set" }, { status: 404 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { ok: false, error: "supabase not configured" },
      { status: 503 },
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });
  }

  // Idempotency: if already unlocked, return current balance + list.
  const { data: existing } = await supabase
    .from("user_content_unlocks")
    .select("set_id")
    .eq("owner_user_id", user.id)
    .eq("set_id", setId)
    .maybeSingle();

  const fetchAll = async () => {
    const { data: all } = await supabase
      .from("user_content_unlocks")
      .select("set_id")
      .eq("owner_user_id", user.id);
    return (all ?? []).map((r) => r.set_id as string);
  };

  const fetchBalance = async (): Promise<number> => {
    const { data: prof } = await supabase
      .from("user_profiles")
      .select("credits")
      .eq("user_id", user.id)
      .maybeSingle();
    const c = (prof as { credits?: number } | null)?.credits;
    return typeof c === "number" ? c : 0;
  };

  if (existing) {
    return NextResponse.json({
      ok: true,
      alreadyOwned: true,
      balance: await fetchBalance(),
      setIds: await fetchAll(),
    });
  }

  const cost = set.credits;
  const balanceBefore = await fetchBalance();
  if (balanceBefore < cost) {
    return NextResponse.json(
      { ok: false, error: "insufficient credits", balance: balanceBefore },
      { status: 402 },
    );
  }

  // Deduct first; if the unlock insert fails we refund. (Best-effort atomicity
  // without a stored procedure — same pattern used by the gift endpoint.)
  const newBalance = balanceBefore - cost;
  const { error: updErr } = await supabase
    .from("user_profiles")
    .update({ credits: newBalance })
    .eq("user_id", user.id);

  if (updErr) {
    return NextResponse.json(
      { ok: false, error: updErr.message },
      { status: 500 },
    );
  }

  const { error: insErr } = await supabase.from("user_content_unlocks").insert({
    owner_user_id: user.id,
    set_id: setId,
    credits_paid: cost,
  });

  if (insErr) {
    // Refund on failure
    await supabase
      .from("user_profiles")
      .update({ credits: balanceBefore })
      .eq("user_id", user.id);
    return NextResponse.json(
      { ok: false, error: insErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    balance: newBalance,
    setIds: await fetchAll(),
  });
}
