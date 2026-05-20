import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { isSupabaseConfigured } from "@/utils/supabase/public-env";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, active: false });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "not signed in" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select(
      "pro_status, pro_started_at, pro_minimum_end_at, pro_stripe_subscription_id",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const row = data as {
    pro_status?: string | null;
    pro_started_at?: string | null;
    pro_minimum_end_at?: string | null;
    pro_stripe_subscription_id?: string | null;
  } | null;

  const active =
    row?.pro_status === "active" && Boolean(row.pro_stripe_subscription_id);

  return NextResponse.json({
    ok: true,
    active,
    status: row?.pro_status ?? null,
    startedAt: row?.pro_started_at ?? null,
    minimumEndAt: row?.pro_minimum_end_at ?? null,
  });
}
