import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  activateProSubscription,
  fulfillProSubscriptionInvoice,
} from "@/lib/credits/fulfill-pro-subscription";
import { PRO_SUBSCRIPTION_PLAN_ID } from "@/lib/credits/pro-subscription";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const sessionId = new URL(req.url).searchParams.get("session_id")?.trim();
  if (!sessionId) {
    return NextResponse.json(
      { ok: false, error: "missing session_id" },
      { status: 400 },
    );
  }

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { ok: false, error: "stripe not configured" },
      { status: 503 },
    );
  }

  const stripe = getStripe();
  const service = getServiceSupabase();
  if (!stripe || !service) {
    return NextResponse.json(
      { ok: false, error: "server not configured" },
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

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "invoice"],
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "invalid session";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  if (session.payment_status !== "paid") {
    return NextResponse.json(
      { ok: false, error: "payment not completed" },
      { status: 402 },
    );
  }

  const meta = session.metadata ?? {};
  if (meta.checkout_type !== "pro_subscription") {
    return NextResponse.json(
      { ok: false, error: "not a Pro checkout session" },
      { status: 400 },
    );
  }

  const metaUserId = meta.user_id?.trim();
  if (!metaUserId || metaUserId !== user.id) {
    return NextResponse.json(
      { ok: false, error: "session does not belong to this user" },
      { status: 403 },
    );
  }

  const subId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;
  if (!subId) {
    return NextResponse.json(
      { ok: false, error: "missing subscription" },
      { status: 400 },
    );
  }

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;

  await activateProSubscription(service, {
    userId: user.id,
    stripeSubscriptionId: subId,
    stripeCustomerId: customerId,
  });

  let grantedCredits = 0;
  let balance = 0;
  let alreadyFulfilled = true;

  const invoiceRef = session.invoice;
  const invoiceId =
    typeof invoiceRef === "string" ? invoiceRef : invoiceRef?.id;

  if (invoiceId) {
    const result = await fulfillProSubscriptionInvoice(service, {
      userId: user.id,
      stripeInvoiceId: invoiceId,
      stripeSubscriptionId: subId,
    });
    if (result.ok) {
      grantedCredits = result.grantedCredits;
      balance = result.balance;
      alreadyFulfilled = result.alreadyFulfilled;
    }
  } else {
    const sub = await stripe.subscriptions.retrieve(subId);
    if (sub.metadata?.plan_id === PRO_SUBSCRIPTION_PLAN_ID) {
      const invList = await stripe.invoices.list({
        subscription: subId,
        limit: 1,
      });
      const inv = invList.data[0];
      if (inv?.id && inv.status === "paid") {
        const result = await fulfillProSubscriptionInvoice(service, {
          userId: user.id,
          stripeInvoiceId: inv.id,
          stripeSubscriptionId: subId,
        });
        if (result.ok) {
          grantedCredits = result.grantedCredits;
          balance = result.balance;
          alreadyFulfilled = result.alreadyFulfilled;
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    balance,
    grantedCredits,
    alreadyFulfilled,
    active: true,
  });
}
