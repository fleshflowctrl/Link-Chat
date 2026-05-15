import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import {
  PersonaForm,
  emptyPersonaFormValues,
  type PersonaFormValues,
} from "@/components/admin/persona-form";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ArchiveIcon } from "@/components/admin/icons";

export const dynamic = "force-dynamic";

type RowFromDb = {
  id: string;
  display_name: string;
  age: number | null;
  city: string | null;
  bio: string | null;
  occupation: string | null;
  backstory: string | null;
  looking_for: string | null;
  avatar_url: string | null;
  gallery_urls: string[] | null;
  interests: unknown;
  vibe_tags: string[] | null;
  funnel_intent_ids: string[] | null;
  filter_tags: string[] | null;
  status_variant: string | null;
  status_label: string | null;
  last_active_label: string | null;
  home_sort: number | null;
  distance_km: number | null;
  verified: boolean | null;
  online_now: boolean | null;
  is_archived: boolean | null;
  joined_at: string | null;
  chat_style: Record<string, unknown> | null;
  photo_style: Record<string, unknown> | null;
  persona_meta: Record<string, unknown> | null;
};

function rowToFormValues(row: RowFromDb): PersonaFormValues {
  const empty = emptyPersonaFormValues();
  const interests = Array.isArray(row.interests)
    ? row.interests
        .filter((x): x is { label: string; icon: string } => {
          if (!x || typeof x !== "object") return false;
          const o = x as { label?: unknown; icon?: unknown };
          return typeof o.label === "string" && typeof o.icon === "string";
        })
    : [];
  const cs = (row.chat_style ?? {}) as Record<string, unknown>;
  const ps = (row.photo_style ?? {}) as Record<string, unknown>;
  const pm = (row.persona_meta ?? {}) as Record<string, unknown>;

  const asStrArr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];

  return {
    ...empty,
    id: row.id,
    display_name: row.display_name ?? "",
    age: typeof row.age === "number" ? row.age : empty.age,
    city: row.city ?? empty.city,
    bio: row.bio ?? "",
    occupation: row.occupation ?? "",
    backstory: row.backstory ?? "",
    looking_for: row.looking_for ?? "",
    avatar_url: row.avatar_url ?? "",
    gallery_urls: asStrArr(row.gallery_urls),
    interests,
    vibe_tags: asStrArr(row.vibe_tags),
    funnel_intent_ids: asStrArr(row.funnel_intent_ids),
    filter_tags: asStrArr(row.filter_tags),
    status_variant: row.status_variant ?? empty.status_variant,
    status_label: row.status_label ?? empty.status_label,
    last_active_label: row.last_active_label ?? empty.last_active_label,
    home_sort: typeof row.home_sort === "number" ? row.home_sort : empty.home_sort,
    distance_km: typeof row.distance_km === "number" ? row.distance_km : empty.distance_km,
    verified: !!row.verified,
    online_now: !!row.online_now,
    is_archived: !!row.is_archived,
    joined_at: row.joined_at ?? empty.joined_at,
    chat_style: {
      verbal_tics: asStrArr(cs.verbal_tics),
      emoji_palette: asStrArr(cs.emoji_palette),
      reply_length: ((): "" | "short" | "medium" | "variable" => {
        const v = typeof cs.reply_length === "string" ? cs.reply_length : "";
        return v === "short" || v === "medium" || v === "variable" ? v : "";
      })(),
      punctuation: ((): "" | "casual" | "clean" => {
        const v = typeof cs.punctuation === "string" ? cs.punctuation : "";
        return v === "casual" || v === "clean" ? v : "";
      })(),
      quirks: asStrArr(cs.quirks),
      talks_less_about: asStrArr(cs.talks_less_about),
    },
    photo_style: {
      appearance: typeof ps.appearance === "string" ? ps.appearance : "",
      build: typeof ps.build === "string" ? ps.build : "",
      style: typeof ps.style === "string" ? ps.style : "",
      vibe: typeof ps.vibe === "string" ? ps.vibe : "",
      seed: typeof ps.seed === "number" ? String(ps.seed) : "",
    },
    persona_meta: {
      languages: asStrArr(pm.languages).length ? asStrArr(pm.languages) : empty.persona_meta.languages,
      personality_traits: asStrArr(pm.personality_traits),
      daily_rhythm: typeof pm.daily_rhythm === "string" ? pm.daily_rhythm : "",
      goals: asStrArr(pm.goals),
      pet_names: asStrArr(pm.pet_names),
      relationship_hint: typeof pm.relationship_hint === "string" ? pm.relationship_hint : "",
      timezone: typeof pm.timezone === "string" ? pm.timezone : empty.persona_meta.timezone,
      voice_style: typeof pm.voice_style === "string" ? pm.voice_style : "",
    },
  };
}

export default async function AdminEditPersonaPage(props: {
  params: { id: string };
}) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.status === 401) redirect(`/login?next=/admin/personas/${props.params.id}/edit`);
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
        <h1 className="text-lg font-semibold">Geen toegang</h1>
        <p className="mt-1 text-sm">{auth.error}</p>
      </div>
    );
  }

  const service = getServiceSupabase();
  if (!service) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        SUPABASE_SERVICE_ROLE_KEY ontbreekt — voeg hem toe aan je env.
      </div>
    );
  }

  const { data, error } = await service
    .from("chat_profiles")
    .select("*")
    .eq("id", props.params.id)
    .maybeSingle();
  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
        <p className="text-sm">{error.message}</p>
      </div>
    );
  }
  if (!data) notFound();

  const initial = rowToFormValues(data as RowFromDb);

  return (
    <div className="mx-auto max-w-7xl">
      <AdminPageHeader
        crumbs={[
          { href: "/admin/personas", label: "Personas" },
          { label: initial.display_name || initial.id },
        ]}
        title={initial.display_name || initial.id}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <code className="rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-gray-700 ring-1 ring-inset ring-black/5">
              {initial.id}
            </code>
            {initial.is_archived ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 ring-1 ring-inset ring-rose-200">
                <ArchiveIcon className="h-3 w-3" />
                Gearchiveerd
              </span>
            ) : null}
          </span>
        }
        actions={
          initial.avatar_url ? (
            <div className="relative h-12 w-12 overflow-hidden rounded-xl ring-1 ring-black/5">
              <Image src={initial.avatar_url} alt="" fill sizes="48px" className="object-cover" />
            </div>
          ) : null
        }
      />
      <PersonaForm mode="edit" initial={initial} idLocked />
    </div>
  );
}
