import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { listAllAuthUsers, type AdminAuthUser } from "@/lib/admin/auth-users";
import { AdminPageHeader } from "@/components/admin/page-header";
import { IdIcon } from "@/components/admin/icons";

export const dynamic = "force-dynamic";

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("nl-NL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

type AdminUserRow = AdminAuthUser & { credits: number | null };

async function loadUserCreditsById(
  service: NonNullable<ReturnType<typeof getServiceSupabase>>,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const { data, error } = await service.from("user_profiles").select("user_id, credits");
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const id = row.user_id;
    if (!id || typeof id !== "string") continue;
    const credits = row.credits;
    if (typeof credits === "number" && credits >= 0) out.set(id, credits);
  }
  return out;
}

async function loadUsers(): Promise<
  | { ok: true; users: AdminUserRow[] }
  | { ok: false; error: string }
> {
  const service = getServiceSupabase();
  if (!service) {
    return {
      ok: false,
      error: "SUPABASE_SERVICE_ROLE_KEY ontbreekt — voeg hem toe aan je env.",
    };
  }
  try {
    const [users, creditsById] = await Promise.all([
      listAllAuthUsers(service),
      loadUserCreditsById(service),
    ]);
    return {
      ok: true,
      users: users.map((u) => ({
        ...u,
        credits: creditsById.get(u.id) ?? null,
      })),
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Onbekende fout",
    };
  }
}

export default async function AdminUsersPage() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.status === 401) redirect("/login?next=/admin/users");
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
        <h1 className="text-lg font-semibold">Geen toegang</h1>
        <p className="mt-1 text-sm">{auth.error}</p>
      </div>
    );
  }

  const res = await loadUsers();

  return (
    <div className="mx-auto max-w-7xl">
      <AdminPageHeader
        crumbs={[{ label: "Admin" }, { label: "Gebruikers" }]}
        title="Gebruikers"
        description={
          res.ok ? (
            <>
              Alle geregistreerde accounts met e-mailadres.{" "}
              <span className="text-gray-500">({res.users.length} totaal)</span>
            </>
          ) : (
            "Alle geregistreerde accounts met e-mailadres."
          )
        }
      />

      {!res.ok ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {res.error}
        </div>
      ) : res.users.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
          <IdIcon className="mb-3 h-8 w-8 text-gray-300" />
          <p className="text-sm font-medium text-gray-700">Nog geen gebruikers</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead>
                <tr className="border-b border-black/5 bg-gray-50/80 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  <th className="px-5 py-3">E-mail</th>
                  <th className="hidden px-5 py-3 sm:table-cell">User ID</th>
                  <th className="px-5 py-3 text-right">Credits</th>
                  <th className="px-5 py-3">Aangemeld</th>
                  <th className="hidden px-5 py-3 md:table-cell">Laatste login</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {res.users.map((u) => (
                  <tr
                    key={u.id}
                    className="transition-colors hover:bg-gray-50/80"
                  >
                    <td className="px-5 py-3.5">
                      <span className="font-medium text-gray-900">
                        {u.email ?? (
                          <span className="italic text-gray-400">Geen e-mail</span>
                        )}
                      </span>
                    </td>
                    <td className="hidden px-5 py-3.5 sm:table-cell">
                      <code className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">
                        {u.id.slice(0, 8)}…
                      </code>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right tabular-nums">
                      {u.credits === null ? (
                        <span className="text-gray-400">—</span>
                      ) : (
                        <span className="font-semibold text-gray-900">
                          {u.credits.toLocaleString("nl-NL")}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-gray-600">
                      {formatDateTime(u.createdAt)}
                    </td>
                    <td className="hidden whitespace-nowrap px-5 py-3.5 text-gray-500 md:table-cell">
                      {formatDateTime(u.lastSignInAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
