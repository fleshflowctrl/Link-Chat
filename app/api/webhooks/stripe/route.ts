import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { fulfillCreditPurchase } from "@/lib/credits/fulfill-purchase";
import {
  activateProSubscription,
  fulfillProSubscriptionInvoice,
} from "@/lib/credits/fulfill-pro-subscription";
import { PRO_SUBSCRIPTION_PLAN_ID } from "@/lib/credits/pro-subscription";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import { getServiceSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function proUserIdFromSubscription(sub: Stripe.Subscription): string | null {
  return sub.metadata?.user_id?.trim() || null;
}

function isProSubscription(sub: Stripe.Subscription): boolean {
  return sub.metadata?.plan_id === PRO_SUBSCRIPTION_PLAN_ID;
}

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
    if (!userId) {
      console.error("[stripe/webhook] missing user_id", session.id);
      return NextResponse.json({ received: true });
    }

    if (meta.checkout_type === "pro_subscription") {
      const subId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;
      if (subId) {
        const customerId =
          typeof session.customer === "string"
            ? session.customer
            : session.customer?.id ?? null;
        const act = await activateProSubscription(service, {
          userId,
          stripeSubscriptionId: subId,
          stripeCustomerId: customerId,
        });
        if (!act.ok) {
          console.error("[stripe/webhook] pro activate", act.error);
          return NextResponse.json({ error: act.error }, { status: 500 });
        }
      }
      return NextResponse.json({ received: true });
    }

    const packageId = meta.package_id?.trim();
    if (!packageId) {
      console.error("[stripe/webhook] missing package_id", session.id);
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

  if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    const subRef = invoice.subscription;
    const subId =
      typeof subRef === "string" ? subRef : subRef?.id ?? null;
    if (!subId || !invoice.id) {
      return NextResponse.json({ received: true });
    }

    let sub: Stripe.Subscription;
    try {
      sub = await stripe.subscriptions.retrieve(subId);
    } catch (e) {
      console.error("[stripe/webhook] subscription retrieve", subId, e);
      return NextResponse.json({ received: true });
    }

    if (!isProSubscription(sub)) {
      return NextResponse.json({ received: true });
    }

    const userId = proUserIdFromSubscription(sub);
    if (!userId) {
      console.error("[stripe/webhook] pro missing user_id on sub", subId);
      return NextResponse.json({ received: true });
    }

    const customerId =
      typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;

    const act = await activateProSubscription(service, {
      userId,
      stripeSubscriptionId: subId,
      stripeCustomerId: customerId,
      startedAt: sub.start_date
        ? new Date(sub.start_date * 1000)
        : undefined,
    });
    if (!act.ok) {
      console.error("[stripe/webhook] pro activate on invoice", act.error);
      return NextResponse.json({ error: act.error }, { status: 500 });
    }

    const grant = await fulfillProSubscriptionInvoice(service, {
      userId,
      stripeInvoiceId: invoice.id,
      stripeSubscriptionId: subId,
    });
    if (!grant.ok) {
      console.error("[stripe/webhook] pro grant", grant.error);
      return NextResponse.json({ error: grant.error }, { status: 500 });
    }
  }

  if (
    event.type === "customer.subscription.deleted" ||
    event.type === "customer.subscription.updated"
  ) {
    const sub = event.data.object as Stripe.Subscription;
    if (!isProSubscription(sub)) {
      return NextResponse.json({ received: true });
    }
    const userId = proUserIdFromSubscription(sub);
    if (!userId) return NextResponse.json({ received: true });

    let proStatus: "active" | "past_due" | "canceled" = "active";
    if (
      sub.status === "canceled" ||
      sub.status === "unpaid" ||
      sub.status === "incomplete_expired"
    ) {
      proStatus = "canceled";
    } else if (
      sub.status === "past_due" ||
      sub.status === "incomplete" ||
      sub.status === "paused"
    ) {
      proStatus = "past_due";
    }

    await service
      .from("user_profiles")
      .update({
        pro_status: proStatus,
        pro_stripe_subscription_id: sub.id,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  }

  return NextResponse.json({ received: true });
}
