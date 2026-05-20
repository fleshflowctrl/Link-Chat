import { NextResponse } from "next/server";
import { SITE_NAME } from "@/lib/brand";
import {
  PRO_SUBSCRIPTION_CREDITS_PER_MONTH,
  PRO_SUBSCRIPTION_MIN_MONTHS,
  PRO_SUBSCRIPTION_PLAN_ID,
  PRO_SUBSCRIPTION_PRICE_EUR,
  proSubscriptionAmountCents,
} from "@/lib/credits/pro-subscription";
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

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
    return NextResponse.json({ ok: false, error: keyError }, { status: 500 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { ok: false, error: "stripe_not_configured", devMode: true },
      { status: 503 },
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
    .select("pro_status, pro_stripe_subscription_id, app_variant")
    .eq("user_id", user.id)
    .maybeSingle();

  if (readErr) {
    return NextResponse.json(
      { ok: false, error: readErr.message },
      { status: 500 },
    );
  }

  const row = prof as {
    pro_status?: string | null;
    pro_stripe_subscription_id?: string | null;
    app_variant?: string | null;
  } | null;

  if (row?.pro_status === "active" && row.pro_stripe_subscription_id) {
    return NextResponse.json(
      {
        ok: false,
        error: "Je hebt Pro al actief.",
        code: "already_subscribed",
      },
      { status: 409 },
    );
  }

  const userVariant = parseAppVariant(row?.app_variant ?? null);
  const amountCents = proSubscriptionAmountCents();
  if (amountCents < 50) {
    return NextResponse.json(
      { ok: false, error: "amount too small for Stripe" },
      { status: 400 },
    );
  }

  const origin = getAppOrigin(req);
  const checkoutBase = `${variantBasePath(userVariant)}/credits/checkout/pro`;
  const successUrl = `${origin}${checkoutBase}?success=1&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}${checkoutBase}?canceled=1`;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: user.email ?? undefined,
      client_reference_id: user.id,
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: amountCents,
            recurring: { interval: "month" },
            product_data: {
              name: `${SITE_NAME} Pro`,
              description: `${PRO_SUBSCRIPTION_CREDITS_PER_MONTH} credits per maand · min. ${PRO_SUBSCRIPTION_MIN_MONTHS} maanden`,
            },
          },
        },
      ],
      subscription_data: {
        metadata: {
          user_id: user.id,
          plan_id: PRO_SUBSCRIPTION_PLAN_ID,
        },
      },
      metadata: {
        user_id: user.id,
        checkout_type: "pro_subscription",
        plan_id: PRO_SUBSCRIPTION_PLAN_ID,
        granted_credits: String(PRO_SUBSCRIPTION_CREDITS_PER_MONTH),
        price_eur: String(PRO_SUBSCRIPTION_PRICE_EUR),
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
    console.error("[pro-subscription/checkout]", e);
    return NextResponse.json(
      { ok: false, error: stripeErrorMessage(e) },
      { status: 500 },
    );
  }
}
