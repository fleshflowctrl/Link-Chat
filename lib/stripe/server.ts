import Stripe from "stripe";

let cached: Stripe | null | undefined;

/** Strip quotes / whitespace accidentally pasted into Vercel env vars. */
export function readStripeSecretKey(): string | null {
  const raw = process.env.STRIPE_SECRET_KEY;
  if (!raw) return null;
  let key = raw.trim();
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  return key || null;
}

export function isStripeConfigured(): boolean {
  return readStripeSecretKey() != null;
}

export function validateStripeSecretKey(key: string): string | null {
  if (key.startsWith("pk_")) {
    return "STRIPE_SECRET_KEY is een publishable key (pk_…). Gebruik de geheime key (sk_live_… of sk_test_…).";
  }
  if (!key.startsWith("sk_test_") && !key.startsWith("sk_live_")) {
    return "STRIPE_SECRET_KEY heeft een ongeldig formaat. Kopieer de volledige geheime key uit Stripe.";
  }
  if (key.length < 80) {
    return "STRIPE_SECRET_KEY lijkt afgekapt. Kopieer de volledige key opnieuw in Vercel.";
  }
  return null;
}

/** User-safe message — never echo raw Stripe errors (they may include key hints). */
export function stripeErrorMessage(e: unknown): string {
  const msg = e instanceof Error ? e.message : "";
  if (/invalid api key/i.test(msg)) {
    return "Betaling is tijdelijk niet beschikbaar (Stripe-sleutel ongeldig). Controleer STRIPE_SECRET_KEY in Vercel.";
  }
  if (/No such api_key/i.test(msg)) {
    return "Stripe-sleutel niet gevonden. Voeg een geldige STRIPE_SECRET_KEY toe in Vercel.";
  }
  return "Betaling mislukt. Probeer het later opnieuw.";
}

/** Server-only Stripe client. Returns null when STRIPE_SECRET_KEY is unset. */
export function getStripe(): Stripe | null {
  if (cached !== undefined) return cached;
  const key = readStripeSecretKey();
  if (!key) {
    cached = null;
    return null;
  }
  const invalid = validateStripeSecretKey(key);
  if (invalid) {
    console.error("[stripe]", invalid);
    cached = null;
    return null;
  }
  cached = new Stripe(key, { typescript: true });
  return cached;
}

/** Canonical app origin for Stripe redirect URLs. */
export function getAppOrigin(req: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;

  const host =
    req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;

  return "http://localhost:3000";
}
