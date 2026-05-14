import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { isSupabaseConfigured } from "@/utils/supabase/public-env";

export const dynamic = "force-dynamic";

/** Mark a payment method as the user's default (clears any previous default). */
export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
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

  const id = params.id;
  if (!id) {
    return NextResponse.json({ ok: false, error: "missing id" }, { status: 400 });
  }

  const { data: target } = await supabase
    .from("user_payment_methods")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!target) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }

  // Two-step (clear current default, then set new) to satisfy the partial
  // unique index in a single transaction-like flow.
  const { error: clearErr } = await supabase
    .from("user_payment_methods")
    .update({ is_default: false })
    .eq("user_id", user.id)
    .eq("is_default", true);
  if (clearErr) {
    return NextResponse.json({ ok: false, error: clearErr.message }, { status: 500 });
  }

  const { error: setErr } = await supabase
    .from("user_payment_methods")
    .update({ is_default: true })
    .eq("id", id)
    .eq("user_id", user.id);
  if (setErr) {
    return NextResponse.json({ ok: false, error: setErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
