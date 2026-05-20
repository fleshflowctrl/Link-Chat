"use client";

import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import { isSupabaseConfigured } from "@/utils/supabase/public-env";

/** Signed-in user with email/password (not an anonymous guest session). */
export function isPermanentAuthUser(user: User | null | undefined): boolean {
  return Boolean(user && user.is_anonymous !== true);
}

/**
 * Ensures a Supabase session exists before funnel chat. Uses anonymous sign-in
 * so messages are stored under a real `owner_user_id` and stay after signup.
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
  if (error) {
    throw new Error(error.message);
  }
  return { userId: data.user?.id ?? null };
}

/**
 * Turn the current anonymous session into a permanent email/password account.
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

  if (!current?.is_anonymous) {
    return { ok: false, error: "Geen gast-sessie om te koppelen." };
  }

  const { data, error } = await supabase.auth.updateUser({
    email,
    password,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const userId = data.user?.id ?? current.id;
  const needsEmailConfirm = !data.user?.email_confirmed_at;

  return { ok: true, needsEmailConfirm, userId };
}
