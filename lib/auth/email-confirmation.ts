import type { User } from "@supabase/supabase-js";

/** True when Supabase still expects the user to confirm their e-mail. */
export function userNeedsEmailConfirmation(
  user: Pick<User, "email_confirmed_at"> | null | undefined,
): boolean {
  return Boolean(user && !user.email_confirmed_at);
}
