import { NextResponse } from "next/server";
import { packages } from "@/data/credits";
import {
  applyDiscount,
  discountForNextPurchase,
} from "@/lib/credits/discount";
import { createClient } from "@/utils/supabase/server";
import { isSupabaseConfigured } from "@/utils/supabase/public-env";

export const dynamic = "force-dynamic";

/**
 * Records a credit-pack purchase atomically:
 *
 *  1. Look up the package by id and the user's current balance + purchase count.
 *  2. Apply the first-time-buyer discount tier (80 / 50 / 20 / 0%).
 *  3. Increase `user_profiles.credits` by `credits + bonus`.
 *  4. Increment `user_profiles.purchase_count` by 1.
 *
 *  Returns the new balance, new purchase count, the price actually charged and
 *  the discount applied so the client can display a confirmation without a
 *  follow-up GET.
 *
 *  In a real app the actual money would move via Stripe / Apple Pay before
 *  hitting this route — for now it just simulates the credit grant.
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid JSON" },
      { status: 400 },
    );
  }

  const obj = (body && typeof body === "object" ? body : {}) as Record<
    string,
    unknown
  >;
  const packageId =
    typeof obj.packageId === "string" ? obj.packageId.trim() : "";
  if (!packageId) {
    return NextResponse.json(
      { ok: false, error: "missing packageId" },
      { status: 400 },
    );
  }

  const pkg = packages.find((p) => p.id === packageId);
  if (!pkg) {
    return NextResponse.json(
      { ok: false, error: "unknown package" },
      { status: 404 },
    );
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
    return NextResponse.json(
      { ok: false, error: "not signed in" },
      { status: 401 },
    );
  }

  const { data: prof, error: readErr } = await supabase
    .from("user_profiles")
    .select("credits, purchase_count")
    .eq("user_id", user.id)
    .maybeSingle();
  if (readErr) {
    return NextResponse.json(
      { ok: false, error: readErr.message },
      { status: 500 },
    );
  }

  const row = prof as { credits?: number; purchase_count?: number } | null;
  const balanceBefore =
    typeof row?.credits === "number" && row.credits >= 0 ? row.credits : 0;
  const countBefore =
    typeof row?.purchase_count === "number" && row.purchase_count >= 0
      ? row.purchase_count
      : 0;

  const discount = discountForNextPurchase(countBefore);
  const paid = applyDiscount(pkg.price, discount);
  const grantedCredits = pkg.credits + pkg.bonus;
  const newBalance = balanceBefore + grantedCredits;
  const newCount = countBefore + 1;

  const { error: updErr } = await supabase
    .from("user_profiles")
    .update({
      credits: newBalance,
      purchase_count: newCount,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (updErr) {
    return NextResponse.json(
      { ok: false, error: updErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    balance: newBalance,
    purchaseCount: newCount,
    grantedCredits,
    paid,
    discount,
    pricePaid: paid,
    originalPrice: pkg.price,
    packageId: pkg.id,
  });
}
