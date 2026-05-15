import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PersonaRow = {
  id: string;
  display_name: string;
  age: number | null;
  city: string | null;
  avatar_url: string;
  bio: string | null;
  occupation: string | null;
  status_variant: string | null;
  status_label: string | null;
  online_now: boolean | null;
  verified: boolean | null;
  is_archived: boolean | null;
  home_sort: number | null;
  joined_at: string | null;
  last_message_at: string | null;
  vibe_tags: string[] | null;
};

async function loadPersonas(): Promise<{
  rows: PersonaRow[];
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
  return { rows: (data ?? []) as PersonaRow[], serviceConfigured: true };
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "—";
  const min = Math.round(ms / 60000);
  if (min < 1) return "net nu";
  if (min < 60) return `${min} min`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `${hrs} u`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days} d`;
  const months = Math.round(days / 30);
  return `${months} mnd`;
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

  const { rows, error, serviceConfigured } = await loadPersonas();
  const active = rows.filter((r) => !r.is_archived);
  const archived = rows.filter((r) => r.is_archived);

  return (
    <div>
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Personas</h1>
          <p className="mt-1 text-sm text-gray-600">
            AI-personas die in discovery, home en chats verschijnen.
            {serviceConfigured ? (
              <span className="ml-1 text-gray-500">({active.length} actief, {archived.length} gearchiveerd)</span>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            Ingelogd als {auth.email ?? auth.userId}
          </span>
          <Link
            href="/admin/personas/new"
            className="rounded-full bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-black"
          >
            + Nieuwe persona
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {error}
        </div>
      )}

      {active.length === 0 && !error ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-600">
          Nog geen personas. Klik <strong>+ Nieuwe persona</strong> om je eerste profiel aan te maken.
        </div>
      ) : (
        <ul className="divide-y divide-black/5 overflow-hidden rounded-2xl border border-black/5 bg-white">
          {active.map((p) => (
            <li key={p.id}>
              <Link
                href={`/admin/personas/${p.id}/edit`}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-gray-50"
              >
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-gray-100 ring-1 ring-black/5">
                  {p.avatar_url ? (
                    <Image
                      src={p.avatar_url}
                      alt={p.display_name}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  ) : null}
                  {p.online_now ? (
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {p.display_name}
                      {p.verified ? (
                        <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 align-middle text-[10px] font-bold text-white">
                          ✓
                        </span>
                      ) : null}
                    </p>
                    <span className="text-xs text-gray-500">·</span>
                    <span className="truncate text-xs text-gray-500">
                      {p.age ?? "?"} · {p.city ?? "—"}
                      {p.occupation ? ` · ${p.occupation}` : ""}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-gray-600">
                    {(p.bio ?? "").trim() || (
                      <span className="italic text-gray-400">Geen bio</span>
                    )}
                  </p>
                  {p.vibe_tags && p.vibe_tags.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {p.vibe_tags.slice(0, 6).map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-gray-700">
                    #{p.home_sort ?? 0}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    laatst: {formatRelative(p.last_message_at)}
                  </p>
                </div>
                <span className="ml-3 rounded-full bg-gray-50 px-2 py-1 text-[10px] font-medium text-gray-500 ring-1 ring-inset ring-black/5">
                  {p.status_label ?? p.status_variant ?? "—"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {archived.length > 0 && (
        <details className="mt-8 group">
          <summary className="cursor-pointer text-sm font-semibold text-gray-600 hover:text-gray-900">
            Gearchiveerd ({archived.length})
          </summary>
          <ul className="mt-3 divide-y divide-black/5 overflow-hidden rounded-2xl border border-black/5 bg-white opacity-70">
            {archived.map((p) => (
              <li key={p.id} className="px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-gray-100 ring-1 ring-black/5">
                    {p.avatar_url ? (
                      <Image src={p.avatar_url} alt={p.display_name} fill sizes="36px" className="object-cover" />
                    ) : null}
                  </div>
                  <p className="text-sm text-gray-700">{p.display_name}</p>
                  <span className="text-xs text-gray-500">{p.id}</span>
                  <Link
                    href={`/admin/personas/${p.id}/edit`}
                    className="ml-auto text-xs font-medium text-gray-600 hover:text-gray-900"
                  >
                    Beheer →
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
