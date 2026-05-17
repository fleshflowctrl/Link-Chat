import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { fulfillCreditPurchase } from "@/lib/credits/fulfill-purchase";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import { getServiceSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "stripe not configured" },
      { status: 503 },
    );
  }

  const stripe = getStripe();
  const service = getServiceSupabase();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();

  if (!stripe || !service || !webhookSecret) {
    return NextResponse.json(
      { error: "webhook not configured" },
      { status: 503 },
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (e) {
    const message = e instanceof Error ? e.message : "invalid signature";
    console.error("[stripe/webhook] signature", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status !== "paid") {
      return NextResponse.json({ received: true });
    }

    const meta = session.metadata ?? {};
    const userId = meta.user_id?.trim();
    const packageId = meta.package_id?.trim();
    if (!userId || !packageId) {
      console.error("[stripe/webhook] missing metadata", session.id);
      return NextResponse.json({ received: true });
    }

    const purchaseCountBefore = Number(meta.purchase_count_before ?? "0");
    const result = await fulfillCreditPurchase(service, {
      userId,
      packageId,
      stripeCheckoutSessionId: session.id,
      purchaseCountBefore: Number.isFinite(purchaseCountBefore)
        ? purchaseCountBefore
        : undefined,
    });

    if (!result.ok) {
      console.error("[stripe/webhook] fulfill failed", result.error);
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
