import { NextResponse } from "next/server";
import { mapSupabaseAuthError } from "@/lib/auth/error-messages";
import { grantSignupCreditsForUser } from "@/lib/credits/grant-signup-credits";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/utils/supabase/public-env";

export const dynamic = "force-dynamic";

const PASSWORD_MIN = 6;

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

type Body = {
  email?: string;
  password?: string;
  next?: string;
};

/**
 * Server-side signup: create confirmed auth user, grant credits, return session.
 * No e-mail verification — user can use the app immediately.
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return bad("Supabase is niet geconfigureerd", 503);
  }

  const admin = getServiceSupabase();
  if (!admin) {
    return bad("SUPABASE_SERVICE_ROLE_KEY ontbreekt op de server", 503);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !anonKey) {
    return bad("Supabase URL of anon key ontbreekt", 503);
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return bad("Ongeldige JSON");
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !email.includes("@")) {
    return bad("Ongeldig e-mailadres");
  }
  if (password.length < PASSWORD_MIN) {
    return bad(`Wachtwoord moet minimaal ${PASSWORD_MIN} tekens zijn`);
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (createErr) {
    const msg = mapSupabaseAuthError(createErr.message);
    const lower = createErr.message.toLowerCase();
    if (
      lower.includes("already") ||
      lower.includes("registered") ||
      lower.includes("exists")
    ) {
      return bad(msg, 409);
    }
    return bad(msg, 400);
  }

  const userId = created.user?.id;
  if (!userId) {
    return bad("Account aanmaken mislukt", 500);
  }

  const grant = await grantSignupCreditsForUser(userId);
  if (!grant.ok) {
    return bad(grant.error ?? "Credits bij registratie mislukt", 500);
  }

  const { createClient } = await import("@supabase/supabase-js");
  const pub = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: signIn, error: signInErr } = await pub.auth.signInWithPassword({
    email,
    password,
  });

  if (signInErr || !signIn.session) {
    return bad(
      signInErr?.message ??
        "Account aangemaakt maar inloggen mislukt — probeer in te loggen.",
      500,
    );
  }

  return NextResponse.json({
    ok: true,
    needsEmailConfirm: false,
    userId,
    access_token: signIn.session.access_token,
    refresh_token: signIn.session.refresh_token,
    signupCredits: grant.credits,
  });
}
