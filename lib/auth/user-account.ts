/** Shared auth helpers (safe on server and client). */

export function isGuestAuthUser(
  user: {
    is_anonymous?: boolean;
    user_metadata?: Record<string, unknown>;
  } | null
  | undefined,
): boolean {
  if (!user) return true;
  if (user.is_anonymous === true) return true;
  return user.user_metadata?.is_funnel_guest === true;
}

export function isPermanentAuthUser(
  user: {
    is_anonymous?: boolean;
    user_metadata?: Record<string, unknown>;
  } | null
  | undefined,
): boolean {
  return !isGuestAuthUser(user);
}
