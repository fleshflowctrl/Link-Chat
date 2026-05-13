import { createClient } from "@/utils/supabase/server";

export type AdminCheckOk = { ok: true; userId: string; email: string | null };
export type AdminCheckFail = { ok: false; status: 401 | 403; error: string };
export type AdminCheck = AdminCheckOk | AdminCheckFail;

/**
 * Verifies the current request comes from an authenticated user whose
 * `user_profiles.is_admin` flag is true. Use from server route handlers and
 * server components for any /admin surface or /api/admin/* endpoint.
 */
export async function requireAdmin(): Promise<AdminCheck> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, status: 401, error: "Niet ingelogd" };
  }

  const { data, error } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return { ok: false, status: 403, error: error.message };
  }

  const isAdmin = Boolean(
    data && (data as { is_admin?: boolean | null }).is_admin,
  );
  if (!isAdmin) {
    return { ok: false, status: 403, error: "Geen admin-rechten" };
  }

  return { ok: true, userId: user.id, email: user.email ?? null };
}
