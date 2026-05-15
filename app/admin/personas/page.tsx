import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { AdminPageHeader } from "@/components/admin/page-header";
import { PersonasList, type PersonaListRow } from "@/components/admin/personas-list";

export const dynamic = "force-dynamic";

async function loadPersonas(): Promise<{
  rows: PersonaListRow[];
  error?: string;
  serviceConfigured: boolean;
}> {
  const service = getServiceSupabase();
  if (!service) {
    return {
      rows: [],
      serviceConfigured: false,
      error: "SUPABASE_SERVICE_ROLE_KEY ontbreekt — voeg hem toe aan je env.",
    };
  }
  const { data, error } = await service
    .from("chat_profiles")
    .select(
      "id, display_name, age, city, avatar_url, bio, occupation, status_variant, status_label, online_now, verified, is_archived, home_sort, joined_at, last_message_at, vibe_tags",
    )
    .eq("is_ai", true)
    .order("home_sort", { ascending: true })
    .order("display_name", { ascending: true });

  if (error) {
    return { rows: [], serviceConfigured: true, error: error.message };
  }
  return { rows: (data ?? []) as PersonaListRow[], serviceConfigured: true };
}

export default async function AdminPersonasPage() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.status === 401) redirect("/login?next=/admin/personas");
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
        <h1 className="text-lg font-semibold">Geen toegang</h1>
        <p className="mt-1 text-sm">{auth.error}</p>
      </div>
    );
  }

  const { rows, error } = await loadPersonas();
  const activeCount = rows.filter((r) => !r.is_archived).length;
  const archivedCount = rows.filter((r) => r.is_archived).length;

  return (
    <div className="mx-auto max-w-7xl">
      <AdminPageHeader
        crumbs={[{ label: "Admin" }, { label: "Personas" }]}
        title="Personas"
        description={
          <>
            AI-personas die in discovery, home en chats verschijnen.{" "}
            <span className="text-gray-500">
              {activeCount} actief, {archivedCount} gearchiveerd.
            </span>
          </>
        }
      />

      {error ? (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {error}
        </div>
      ) : null}

      <PersonasList rows={rows} />
    </div>
  );
}
