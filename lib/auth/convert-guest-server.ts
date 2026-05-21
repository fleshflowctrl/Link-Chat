import { isGuestAuthUser } from "@/lib/auth/user-account";
import { grantSignupCreditsForUser } from "@/lib/credits/grant-signup-credits";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { mapSupabaseAuthError } from "@/lib/auth/error-messages";

export type ConvertGuestResult =
  | {
      ok: true;
      userId: string;
      needsEmailConfirm: boolean;
      accessToken: string;
      refreshToken: string;
      signupCredits: number;
    }
  | { ok: false; error: string };

/**
 * Promote funnel guest or anonymous auth user to a real email/password account
 * via Admin API (avoids client updateUser failing on guest.whisper.invalid).
 */
export async function convertGuestToPermanentAccountServer(input: {
  userId: string;
  email: string;
  password: string;
}): Promise<ConvertGuestResult> {
  const admin = getServiceSupabase();
  if (!admin) {
    return { ok: false, error: "Server niet geconfigureerd (service role ontbreekt)" };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !anonKey) {
    return { ok: false, error: "Supabase URL of anon key ontbreekt" };
  }

  const email = input.email.trim().toLowerCase();
  const password = input.password;
  if (!email || !email.includes("@")) {
    return { ok: false, error: "Ongeldig e-mailadres" };
  }
  if (!password || password.length < 6) {
    return { ok: false, error: "Wachtwoord moet minimaal 6 tekens zijn" };
  }

  const { data: existing, error: getErr } = await admin.auth.admin.getUserById(
    input.userId,
  );
  if (getErr || !existing.user) {
    return { ok: false, error: getErr?.message ?? "Gebruiker niet gevonden" };
  }

  if (!isGuestAuthUser(existing.user)) {
    return { ok: false, error: "Dit account is al een vast account." };
  }

  const priorMeta =
    existing.user.user_metadata &&
    typeof existing.user.user_metadata === "object"
      ? existing.user.user_metadata
      : {};

  const { error: updateErr } = await admin.auth.admin.updateUserById(
    input.userId,
    {
      email,
      password,
      email_confirm: true,
      user_metadata: {
        ...priorMeta,
        is_funnel_guest: false,
      },
    },
  );

  if (updateErr) {
    return { ok: false, error: mapSupabaseAuthError(updateErr.message) };
  }

  const grant = await grantSignupCreditsForUser(input.userId);
  if (!grant.ok) {
    return {
      ok: false,
      error: grant.error ?? "Credits bij registratie mislukt",
    };
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
    return {
      ok: false,
      error:
        signInErr?.message ??
        "Account bijgewerkt maar inloggen mislukt — probeer in te loggen.",
    };
  }

  return {
    ok: true,
    userId: input.userId,
    needsEmailConfirm: false,
    accessToken: signIn.session.access_token,
    refreshToken: signIn.session.refresh_token,
    signupCredits: grant.credits,
  };
}
