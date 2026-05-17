import { NextResponse } from "next/server";
import { fulfillCreditPurchase } from "@/lib/credits/fulfill-purchase";
import { getStripe, isStripeConfigured } from "@/lib/stripe/server";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * After Stripe redirects back with `session_id`, confirm payment and grant
 * credits if the webhook has not run yet.
 */
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

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
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
  const metaUserId = meta.user_id?.trim();
  const packageId = meta.package_id?.trim();
  if (!metaUserId || metaUserId !== user.id) {
    return NextResponse.json(
      { ok: false, error: "session does not belong to this user" },
      { status: 403 },
    );
  }
  if (!packageId) {
    return NextResponse.json(
      { ok: false, error: "missing package in session" },
      { status: 400 },
    );
  }

  const purchaseCountBefore = Number(meta.purchase_count_before ?? "0");

  const result = await fulfillCreditPurchase(service, {
    userId: user.id,
    packageId,
    stripeCheckoutSessionId: session.id,
    purchaseCountBefore: Number.isFinite(purchaseCountBefore)
      ? purchaseCountBefore
      : undefined,
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
    alreadyFulfilled: result.alreadyFulfilled,
  });
}
