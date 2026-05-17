import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminAuthUser = {
  id: string;
  email: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
};

/** All auth users via service-role `listUsers`, newest first. */
export async function listAllAuthUsers(
  service: SupabaseClient,
): Promise<AdminAuthUser[]> {
  const out: AdminAuthUser[] = [];
  const perPage = 200;

  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw new Error(error.message);

    const users = data?.users ?? [];
    for (const u of users) {
      out.push({
        id: String(u.id),
        email: u.email ?? null,
        createdAt: u.created_at ?? null,
        lastSignInAt: u.last_sign_in_at ?? null,
      });
    }
    if (users.length < perPage) break;
  }

  out.sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });

  return out;
}
