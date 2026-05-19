import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { AdminPageHeader } from "@/components/admin/page-header";
import { PersonasList, type PersonaListRow } from "@/components/admin/personas-list";
import { MigrationBanner } from "@/components/admin/migration-banner";
import { BulkGenerateCard } from "@/components/admin/bulk-generate-card";
import { ImageBackendStatus } from "@/components/admin/image-backend-status";
import { probeDbHealth, type DbHealthReport } from "@/lib/admin/db-health";

export const dynamic = "force-dynamic";

async function loadPersonas(): Promise<{
  rows: PersonaListRow[];
  error?: string;
  serviceConfigured: boolean;
  health: DbHealthReport | null;
}> {
  const service = getServiceSupabase();
  if (!service) {
    return {
      rows: [],
      serviceConfigured: false,
      health: null,
      error: "SUPABASE_SERVICE_ROLE_KEY ontbreekt — voeg hem toe aan je env.",
    };
  }

  const health = await probeDbHealth(service);

  // Use select("*") so missing-column migrations don't blow this query
  // up — the banner above the list explains exactly which migration is
  // outstanding. Wider payload but the admin operates on small result
  // sets so this is fine.
  // Newest first. nullsFirst=false keeps legacy personas (no joined_at)
  // at the bottom; the migration 20260516210000 backfills those so this
  // matters less over time, but the option keeps things robust.
  const { data, error } = await service
    .from("chat_profiles")
    .select("*")
    .eq("is_ai", true)
    .order("joined_at", { ascending: false, nullsFirst: false })
    .order("display_name", { ascending: true });

  if (error) {
    return { rows: [], serviceConfigured: true, health, error: error.message };
  }

  const rows = ((data ?? []) as Array<Record<string, unknown>>).map((r): PersonaListRow => ({
    id: String(r.id ?? ""),
    display_name: String(r.display_name ?? ""),
    age: typeof r.age === "number" ? r.age : null,
    city: typeof r.city === "string" ? r.city : null,
    avatar_url: typeof r.avatar_url === "string" ? r.avatar_url : "",
    bio: typeof r.bio === "string" ? r.bio : null,
    occupation: typeof r.occupation === "string" ? r.occupation : null,
    status_variant: typeof r.status_variant === "string" ? r.status_variant : null,
    status_label: typeof r.status_label === "string" ? r.status_label : null,
    online_now: typeof r.online_now === "boolean" ? r.online_now : null,
    verified: typeof r.verified === "boolean" ? r.verified : null,
    is_archived: typeof r.is_archived === "boolean" ? r.is_archived : false,
    home_sort: typeof r.home_sort === "number" ? r.home_sort : null,
    joined_at: typeof r.joined_at === "string" ? r.joined_at : null,
    last_message_at: typeof r.last_message_at === "string" ? r.last_message_at : null,
    vibe_tags: Array.isArray(r.vibe_tags)
      ? (r.vibe_tags as unknown[]).filter((s): s is string => typeof s === "string")
      : null,
    app_variant:
      typeof r.app_variant === "string" && r.app_variant === "v2" ? "v2" : "v1",
  }));

  return { rows, serviceConfigured: true, health };
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

  const { rows, error, health } = await loadPersonas();
  const activeCount = rows.filter((r) => !r.is_archived).length;
  const archivedCount = rows.filter((r) => r.is_archived).length;
  const v2ActiveCount = rows.filter(
    (r) => r.app_variant === "v2" && !r.is_archived,
  ).length;

  return (
    <div className="mx-auto max-w-7xl">
      <AdminPageHeader
        crumbs={[{ label: "Admin" }, { label: "Personas" }]}
        title="Personas"
        description={
          <>
            AI-personas die in discovery, home en chats verschijnen.{" "}
            <span className="text-gray-500">
              {activeCount} actief ({v2ActiveCount} v2), {archivedCount} gearchiveerd.
            </span>
          </>
        }
      />

      {health ? <MigrationBanner report={health} /> : null}

      {error ? (
        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
          {error}
        </div>
      ) : null}

      <ImageBackendStatus />

      <BulkGenerateCard />

      <PersonasList rows={rows} />
    </div>
  );
}
