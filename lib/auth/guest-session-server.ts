import { createHmac, randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getServiceSupabase } from "@/lib/supabase/admin";

export const GUEST_UID_COOKIE = "whisper_guest_uid";

const GUEST_EMAIL_DOMAIN = "guest.whisper.invalid";

function guestSessionSecret(): string {
  const s =
    process.env.GUEST_SESSION_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!s) throw new Error("GUEST_SESSION_SECRET of SUPABASE_SERVICE_ROLE_KEY ontbreekt");
  return s;
}

export function guestEmailForUid(guestUid: string): string {
  return `guest.${guestUid}@${GUEST_EMAIL_DOMAIN}`;
}

export function guestPasswordForUid(guestUid: string): string {
  return createHmac("sha256", guestSessionSecret())
    .update(guestUid)
    .digest("base64url")
    .slice(0, 32);
}

export type GuestSessionTokens = {
  guestUid: string;
  userId: string;
  accessToken: string;
  refreshToken: string;
};

/**
 * Create (or reuse) an internal email/password guest auth user and return
 * session tokens. Works when Supabase "Anonymous sign-ins" is disabled.
 */
export async function mintGuestSessionTokens(
  existingGuestUid: string | null | undefined,
): Promise<GuestSessionTokens> {
  const admin = getServiceSupabase();
  if (!admin) {
    throw new Error("Supabase service role niet geconfigureerd");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !anonKey) {
    throw new Error("Supabase URL of anon key ontbreekt");
  }

  let guestUid = existingGuestUid?.trim() || "";
  if (!guestUid) guestUid = randomUUID();

  const email = guestEmailForUid(guestUid);
  const password = guestPasswordForUid(guestUid);

  const trySignIn = async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const pub = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return pub.auth.signInWithPassword({ email, password });
  };

  let signIn = await trySignIn();

  if (signIn.error) {
    const { error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { is_funnel_guest: true },
    });

    if (createErr && !/already|registered|exists/i.test(createErr.message)) {
      throw new Error(createErr.message);
    }

    signIn = await trySignIn();
    if (signIn.error || !signIn.data.session) {
      throw new Error(signIn.error?.message ?? "Gast-sessie starten mislukt");
    }
  }

  const session = signIn.data.session;
  const userId = signIn.data.user?.id;
  if (!session?.access_token || !session.refresh_token || !userId) {
    throw new Error("Geen sessie ontvangen voor gast-account");
  }

  return {
    guestUid,
    userId,
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
  };
}

export function isFunnelGuestUser(
  user: { is_anonymous?: boolean; user_metadata?: Record<string, unknown> } | null | undefined,
): boolean {
  if (!user) return false;
  if (user.is_anonymous === true) return true;
  return user.user_metadata?.is_funnel_guest === true;
}
