"use client";

import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import { isSupabaseConfigured } from "@/utils/supabase/public-env";

/** Signed-in user with a real account (not anonymous / funnel guest). */
export function isPermanentAuthUser(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.is_anonymous === true) return false;
  if (user.user_metadata?.is_funnel_guest === true) return false;
  return true;
}

function isFunnelGuestUser(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.is_anonymous === true) return true;
  return user.user_metadata?.is_funnel_guest === true;
}

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

/**
 * Ensures a Supabase session exists before funnel chat. Tries anonymous sign-in
 * first; if disabled on the project, falls back to server-minted guest accounts.
 */
export async function ensureGuestSession(): Promise<{ userId: string | null }> {
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

  const { data, error } = await supabase.auth.signInAnonymously();
  if (!error && data.user) {
    return { userId: data.user.id };
  }

  const anonDisabled =
    error?.message?.toLowerCase().includes("anonymous") ?? false;
  if (!anonDisabled && error) {
    throw new Error(error.message);
  }

  return startServerGuestSession();
}

/**
 * Turn the current guest session into a permanent email/password account.
 * Keeps the same auth user id (and all chat rows).
 */
export async function convertAnonymousToPermanentAccount(input: {
  email: string;
  password: string;
}): Promise<
  | { ok: true; needsEmailConfirm: boolean; userId: string | null }
  | { ok: false; error: string }
> {
  if (!isSupabaseConfigured()) {
    return { ok: true, needsEmailConfirm: false, userId: null };
  }

  const supabase = createClient();
  const email = input.email.trim();
  const password = input.password;

  const {
    data: { user: current },
  } = await supabase.auth.getUser();

  if (!isFunnelGuestUser(current)) {
    return { ok: false, error: "Geen gast-sessie om te koppelen." };
  }

  const { data, error } = await supabase.auth.updateUser({
    email,
    password,
    data: { is_funnel_guest: false },
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const userId = data.user?.id ?? current?.id ?? null;
  const needsEmailConfirm = !data.user?.email_confirmed_at;

  return { ok: true, needsEmailConfirm, userId };
}
