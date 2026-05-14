import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { isSupabaseConfigured } from "@/utils/supabase/public-env";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, balance: null, anonymous: true });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: true, balance: null, anonymous: true });
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("credits, purchase_count")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  const row = data as { credits?: number; purchase_count?: number } | null;
  return NextResponse.json({
    ok: true,
    balance:
      typeof row?.credits === "number" && row.credits >= 0 ? row.credits : 0,
    purchaseCount:
      typeof row?.purchase_count === "number" && row.purchase_count >= 0
        ? row.purchase_count
        : 0,
    userId: user.id,
  });
}

export async function PUT(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true });
  }

  let body: { balance?: unknown } = {};
  try {
    body = (await req.json()) as { balance?: unknown };
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const balance =
    typeof body.balance === "number" && body.balance >= 0
      ? Math.floor(body.balance)
      : null;
  if (balance === null) {
    return NextResponse.json(
      { ok: false, error: "balance must be a non-negative number" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated" },
      { status: 401 },
    );
  }

  const { error } = await supabase
    .from("user_profiles")
    .update({ credits: balance, updated_at: new Date().toISOString() })
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, balance });
}
