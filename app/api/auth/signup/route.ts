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
  nickname?: string;
  age?: number;
  city?: string;
  password?: string;
  next?: string;
  visitorId?: string;
};

const UUID_RX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

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
  const nickname = typeof body.nickname === "string" ? body.nickname.trim() : "";
  const city = typeof body.city === "string" ? body.city.trim() : "";
  const ageRaw = body.age;
  const age =
    typeof ageRaw === "number" && Number.isFinite(ageRaw)
      ? Math.round(ageRaw)
      : NaN;
  const visitorIdRaw =
    typeof body.visitorId === "string" ? body.visitorId.trim() : "";
  const visitorId = UUID_RX.test(visitorIdRaw) ? visitorIdRaw : null;

  if (!email || !email.includes("@")) {
    return bad("Ongeldig e-mailadres");
  }
  if (!nickname) {
    return bad("Vul een nickname in.");
  }
  if (!Number.isFinite(age) || age < 18 || age > 120) {
    return bad("Vul een geldige leeftijd in (18–120).");
  }
  if (!city) {
    return bad("Vul je stad in.");
  }
  if (password.length < PASSWORD_MIN) {
    return bad(`Wachtwoord moet minimaal ${PASSWORD_MIN} tekens zijn`);
  }

  // Device/browser-level guard: one permanent signup per tracked visitor id.
  if (visitorId) {
    const { data: existingVisit, error: visitErr } = await admin
      .from("site_visits")
      .select("signed_up_user_id")
      .eq("visitor_id", visitorId)
      .maybeSingle();
    if (visitErr) {
      return bad("Kon apparaatcontrole niet uitvoeren. Probeer opnieuw.", 500);
    }
    const alreadySignedUp =
      !!existingVisit &&
      typeof (existingVisit as { signed_up_user_id?: string | null })
        .signed_up_user_id === "string";
    if (alreadySignedUp) {
      return bad(
        "Er is al een account gekoppeld aan dit apparaat. Log in met je bestaande account.",
        409,
      );
    }
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

  // Persist basic profile fields for the new account (service role bypasses RLS).
  await admin
    .from("user_profiles")
    .upsert(
      {
        user_id: userId,
        first_name: nickname,
        age,
        location: city,
        credits: 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  const grant = await grantSignupCreditsForUser(userId);
  if (!grant.ok) {
    return bad(grant.error ?? "Credits bij registratie mislukt", 500);
  }

  // If this signup came from a tracked visitor, bind that visitor to the
  // newly created auth user so future signups from this browser are blocked.
  if (visitorId) {
    const now = new Date().toISOString();
    const { data: existingVisit } = await admin
      .from("site_visits")
      .select("visitor_id, signed_up_user_id")
      .eq("visitor_id", visitorId)
      .maybeSingle();

    if (existingVisit) {
      const row = existingVisit as { signed_up_user_id?: string | null };
      if (!row.signed_up_user_id) {
        await admin
          .from("site_visits")
          .update({ signed_up_user_id: userId, signed_up_at: now })
          .eq("visitor_id", visitorId);
      }
    } else {
      await admin.from("site_visits").insert({
        visitor_id: visitorId,
        first_visit_at: now,
        last_visit_at: now,
        visit_count: 1,
        signed_up_user_id: userId,
        signed_up_at: now,
      });
    }
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
