import { NextResponse } from "next/server";
import { packages } from "@/data/credits";
import { SITE_NAME } from "@/lib/brand";
import {
  applyDiscount,
  discountForNextPurchase,
} from "@/lib/credits/discount";
import {
  getAppOrigin,
  getStripe,
  isStripeConfigured,
  readStripeSecretKey,
  stripeErrorMessage,
  validateStripeSecretKey,
} from "@/lib/stripe/server";
import { createClient } from "@/utils/supabase/server";
import { isSupabaseConfigured } from "@/utils/supabase/public-env";
import { parseAppVariant, variantBasePath } from "@/lib/app-variant";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { recordCheckoutClick } from "@/lib/credits/checkout-clicks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Creates a Stripe Checkout session for a credit pack. The client redirects
 * the user to `url`; credits are granted in the webhook after payment.
 */
export async function POST(req: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { ok: false, error: "stripe_not_configured", devMode: true },
      { status: 503 },
    );
  }

  const secretKey = readStripeSecretKey();
  const keyError = secretKey ? validateStripeSecretKey(secretKey) : null;
  if (keyError) {
    console.error("[credits/checkout]", keyError);
    return NextResponse.json(
      { ok: false, error: keyError },
      { status: 500 },
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { ok: false, error: "stripe_not_configured", devMode: true },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
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
    .select("credits, purchase_count, app_variant")
    .eq("user_id", user.id)
    .maybeSingle();
  if (readErr) {
    return NextResponse.json(
      { ok: false, error: readErr.message },
      { status: 500 },
    );
  }

  const row = prof as { purchase_count?: number; app_variant?: string | null } | null;
  const userVariant = parseAppVariant(row?.app_variant ?? null);
  const purchaseCountBefore =
    typeof row?.purchase_count === "number" && row.purchase_count >= 0
      ? row.purchase_count
      : 0;

  const discount = discountForNextPurchase(purchaseCountBefore);
  const paid = applyDiscount(pkg.price, discount);
  const grantedCredits = pkg.credits + pkg.bonus;
  const amountCents = Math.round(paid * 100);

  // Log the click attempt before we hand off to Stripe so the admin dash
  // can show click → paid conversion. Best-effort: service role write that
  // never blocks the actual checkout.
  const service = getServiceSupabase();
  if (service) {
    void recordCheckoutClick(service, {
      userId: user.id,
      packageId: pkg.id,
      amountCents,
      discount,
      purchaseCountBefore,
      source: "stripe",
      appVariant: userVariant,
    });
  }

  if (amountCents < 50) {
    return NextResponse.json(
      { ok: false, error: "amount too small for Stripe" },
      { status: 400 },
    );
  }

  const origin = getAppOrigin(req);
  const creditsBase = `${variantBasePath(userVariant)}/credits/checkout/${encodeURIComponent(pkg.id)}`;
  const successUrl = `${origin}${creditsBase}?success=1&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}${creditsBase}?canceled=1`;

  const description =
    pkg.bonus > 0
      ? `${pkg.credits} credits + ${pkg.bonus} bonus`
      : `${pkg.credits} credits`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email ?? undefined,
      client_reference_id: user.id,
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: amountCents,
            product_data: {
              name: `${SITE_NAME} · ${pkg.credits} credits`,
              description,
            },
          },
        },
      ],
      metadata: {
        user_id: user.id,
        package_id: pkg.id,
        granted_credits: String(grantedCredits),
        purchase_count_before: String(purchaseCountBefore),
        discount: String(discount),
        amount_cents: String(amountCents),
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    if (!session.url) {
      return NextResponse.json(
        { ok: false, error: "Stripe session has no URL" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      url: session.url,
      sessionId: session.id,
    });
  } catch (e) {
    console.error("[credits/checkout]", e);
    return NextResponse.json(
      { ok: false, error: stripeErrorMessage(e) },
      { status: 500 },
    );
  }
}
