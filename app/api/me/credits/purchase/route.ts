import { NextResponse } from "next/server";
import { findCreditPackage } from "@/data/credits";
import { fulfillCreditPurchase } from "@/lib/credits/fulfill-purchase";
import {
  canPurchasePackage,
  FIRST_PURCHASE_ONLY_ERROR,
} from "@/lib/credits/package-access";
import { recordCheckoutClick } from "@/lib/credits/checkout-clicks";
import { isStripeConfigured } from "@/lib/stripe/server";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { createClient } from "@/utils/supabase/server";
import { isSupabaseConfigured } from "@/utils/supabase/public-env";

export const dynamic = "force-dynamic";

/**
 * Dev-only simulated purchase when Stripe is not configured.
 * With Stripe enabled, use POST /api/me/credits/checkout instead.
 */
export async function POST(req: Request) {
  if (isStripeConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: "stripe_enabled",
        message: "Gebruik Stripe checkout — directe aankoop is uitgeschakeld.",
      },
      { status: 403 },
    );
  }

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

  const pkg = findCreditPackage(packageId);
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

  const service = getServiceSupabase();
  if (!service) {
    return NextResponse.json(
      { ok: false, error: "service role missing" },
      { status: 503 },
    );
  }

  const { data: prof, error: readErr } = await service
    .from("user_profiles")
    .select("purchase_count")
    .eq("user_id", user.id)
    .maybeSingle();
  if (readErr) {
    return NextResponse.json(
      { ok: false, error: readErr.message },
      { status: 500 },
    );
  }

  const purchaseCountBefore =
    typeof (prof as { purchase_count?: number } | null)?.purchase_count ===
      "number" &&
    (prof as { purchase_count: number }).purchase_count >= 0
      ? (prof as { purchase_count: number }).purchase_count
      : 0;

  if (!canPurchasePackage(pkg, purchaseCountBefore)) {
    return NextResponse.json(
      { ok: false, error: FIRST_PURCHASE_ONLY_ERROR },
      { status: 403 },
    );
  }

  // Mirror the click log we keep for the Stripe flow so the admin metrics
  // page treats dev purchases the same way for the click → paid funnel.
  void recordCheckoutClick(service, {
    userId: user.id,
    packageId: pkg.id,
    amountCents: Math.round(pkg.price * 100),
    discount: 0,
    purchaseCountBefore: purchaseCountBefore,
    source: "dev",
  });

  const result = await fulfillCreditPurchase(service, {
    userId: user.id,
    packageId: pkg.id,
    stripeCheckoutSessionId: null,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    balance: result.balance,
    purchaseCount: result.purchaseCount,
    grantedCredits: result.grantedCredits,
    paid: result.paid,
    discount: result.discount,
    pricePaid: result.paid,
    originalPrice: pkg.price,
    packageId: pkg.id,
    devMode: true,
  });
}
