"use client";

import { applyServerCreditsUpdate } from "@/lib/credits-store";
import { createClient } from "@/utils/supabase/client";
import { isSupabaseConfigured } from "@/utils/supabase/public-env";

export {
  isGuestAuthUser,
  isPermanentAuthUser,
} from "@/lib/auth/user-account";

async function startServerGuestSession(): Promise<{ userId: string | null }> {
  const res = await fetch("/api/auth/guest-session", {
    method: "POST",
    credentials: "same-origin",
  });
  const data = (await res.json()) as {
    ok?: boolean;
    skipped?: boolean;
    userId?: string;
    access_token?: string;
    refresh_token?: string;
    error?: string;
  };

  if (data.skipped) return { userId: null };
  if (!res.ok || !data.ok || !data.access_token || !data.refresh_token) {
    throw new Error(data.error ?? `Gast-sessie mislukt (${res.status})`);
  }

  const supabase = createClient();
  const { error } = await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });
  if (error) throw new Error(error.message);

  return { userId: data.userId ?? null };
}

let guestSessionInFlight: Promise<{ userId: string | null }> | null = null;

async function ensureGuestSessionInner(): Promise<{ userId: string | null }> {
  if (!isSupabaseConfigured()) {
    return { userId: null };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    return { userId: user.id };
  }

  // Server-minted guest — skip slow anonymous sign-in round-trip.
  return startServerGuestSession();
}

/**
 * Ensures a Supabase session exists before chat/credits. Deduped so discover
 * bootstrap and SessionSyncProvider don't run this twice in parallel.
 */
export async function ensureGuestSession(): Promise<{ userId: string | null }> {
  if (!guestSessionInFlight) {
    guestSessionInFlight = ensureGuestSessionInner().catch((err) => {
      guestSessionInFlight = null;
      throw err;
    });
  }
  return guestSessionInFlight;
}

/**
 * Turn the current guest session into a permanent email/password account.
 * Keeps the same auth user id (and all chat rows). Uses server Admin API so
 * guest.whisper.invalid emails do not break client updateUser.
 */
export async function convertAnonymousToPermanentAccount(input: {
  email: string;
  password: string;
  nextPath?: string;
  nickname?: string;
  age?: number;
  city?: string;
}): Promise<
  | { ok: true; needsEmailConfirm: boolean; userId: string | null }
  | { ok: false; error: string }
> {
  if (!isSupabaseConfigured()) {
    return { ok: true, needsEmailConfirm: false, userId: null };
  }

  const res = await fetch("/api/auth/convert-guest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      email: input.email.trim(),
      password: input.password,
      next: input.nextPath,
      nickname: input.nickname,
      age: input.age,
      city: input.city,
    }),
  });

  const data = (await res.json()) as {
    ok?: boolean;
    skipped?: boolean;
    userId?: string;
    needsEmailConfirm?: boolean;
    signupCredits?: number;
    access_token?: string;
    refresh_token?: string;
    error?: string;
  };

  if (data.skipped) {
    return { ok: true, needsEmailConfirm: false, userId: null };
  }

  if (!res.ok || !data.ok) {
    return {
      ok: false,
      error: data.error ?? `Account koppelen mislukt (${res.status})`,
    };
  }

  if (data.access_token && data.refresh_token) {
    const supabase = createClient();
    const { error: sessionErr } = await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });
    if (sessionErr) {
      return { ok: false, error: sessionErr.message };
    }
  }

  if (typeof data.signupCredits === "number" && data.signupCredits >= 0) {
    applyServerCreditsUpdate(data.signupCredits);
  }

  return {
    ok: true,
    needsEmailConfirm: Boolean(data.needsEmailConfirm),
    userId: data.userId ?? null,
  };
}
