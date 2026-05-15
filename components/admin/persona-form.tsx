"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { FUNNEL_LOOKING_FOR, FUNNEL_VIBES } from "@/data/funnel";

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

type Interest = { label: string; icon: string };

type ChatStyleForm = {
  verbal_tics: string[];
  emoji_palette: string[];
  reply_length: "" | "short" | "medium" | "variable";
  punctuation: "" | "casual" | "clean";
  quirks: string[];
  talks_less_about: string[];
};

type PhotoStyleForm = {
  appearance: string;
  build: string;
  style: string;
  vibe: string;
  seed: string;
};

type PersonaMetaForm = {
  languages: string[];
  personality_traits: string[];
  daily_rhythm: string;
  goals: string[];
  pet_names: string[];
  relationship_hint: string;
  timezone: string;
  voice_style: string;
};

export type PersonaFormValues = {
  id: string;
  display_name: string;
  age: number;
  city: string;
  bio: string;
  occupation: string;
  backstory: string;
  looking_for: string;
  avatar_url: string;
  gallery_urls: string[];
  interests: Interest[];
  vibe_tags: string[];
  funnel_intent_ids: string[];
  filter_tags: string[];
  status_variant: string;
  status_label: string;
  last_active_label: string;
  home_sort: number;
  distance_km: number;
  verified: boolean;
  online_now: boolean;
  is_archived: boolean;
  joined_at: string;
  chat_style: ChatStyleForm;
  photo_style: PhotoStyleForm;
  persona_meta: PersonaMetaForm;
};

const FILTER_TAG_OPTIONS: Array<{ id: string; label: string; hint: string }> = [
  { id: "links", label: "Links", hint: "open voor connectie" },
  { id: "active", label: "Actief", hint: "energiek, speels" },
  { id: "replies", label: "Reageert", hint: "aanwezig, attent" },
  { id: "online", label: "Online", hint: "hier-en-nu, direct" },
  { id: "more", label: "Meer", hint: "iets diepere vragen" },
];

const STATUS_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "active", label: "Active now" },
  { id: "online", label: "Online" },
  { id: "new", label: "New" },
  { id: "popular", label: "Popular" },
  { id: "replied", label: "Replied recently" },
  { id: "quiet", label: "Quiet tonight" },
];

const ICON_OPTIONS = ["caring", "romantic", "playful", "warm", "listener"];

/* -------------------------------------------------------------------------- */
/* Defaults                                                                    */
/* -------------------------------------------------------------------------- */

export function emptyPersonaFormValues(): PersonaFormValues {
  return {
    id: "",
    display_name: "",
    age: 26,
    city: "Amsterdam",
    bio: "",
    occupation: "",
    backstory: "",
    looking_for: "",
    avatar_url: "",
    gallery_urls: [],
    interests: [],
    vibe_tags: [],
    funnel_intent_ids: [],
    filter_tags: ["links", "active", "online"],
    status_variant: "active",
    status_label: "Active now",
    last_active_label: "Active today",
    home_sort: 100,
    distance_km: 4,
    verified: false,
    online_now: true,
    is_archived: false,
    joined_at: new Date().toISOString(),
    chat_style: {
      verbal_tics: [],
      emoji_palette: [],
      reply_length: "short",
      punctuation: "casual",
      quirks: [],
      talks_less_about: [],
    },
    photo_style: { appearance: "", build: "", style: "", vibe: "", seed: "" },
    persona_meta: {
      languages: ["nl"],
      personality_traits: [],
      daily_rhythm: "",
      goals: [],
      pet_names: [],
      relationship_hint: "",
      timezone: "Europe/Amsterdam",
      voice_style: "",
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/* -------------------------------------------------------------------------- */
/* Section primitive                                                           */
/* -------------------------------------------------------------------------- */

function Section({
  title,
  description,
  children,
  defaultOpen = true,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-2xl border border-black/5 bg-white shadow-sm"
    >
      <summary className="flex cursor-pointer items-center justify-between px-6 py-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs text-gray-500">{description}</p>
          ) : null}
        </div>
        <span className="text-xs text-gray-400 group-open:rotate-180 transition-transform">▾</span>
      </summary>
      <div className="space-y-4 border-t border-black/5 px-6 py-5">{children}</div>
    </details>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      {hint ? <span className="ml-2 text-xs text-gray-400">{hint}</span> : null}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={
        "w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 " +
        (props.className ?? "")
      }
    />
  );
}

function textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={
        "w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 " +
        (props.className ?? "")
      }
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Chip-list primitive (comma-or-newline-separated tags)                       */
/* -------------------------------------------------------------------------- */

function ChipList({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (!values.includes(v)) onChange([...values, v]);
    setDraft("");
  };
  const remove = (idx: number) => onChange(values.filter((_, i) => i !== idx));
  return (
    <div className="rounded-xl border border-gray-300 bg-white px-3 py-2 shadow-sm">
      <div className="flex flex-wrap gap-1.5">
        {values.map((v, i) => (
          <span
            key={`${v}-${i}`}
            className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700"
          >
            {v}
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-gray-400 hover:text-gray-700"
              aria-label="verwijder"
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
            if (e.key === "Backspace" && !draft && values.length) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={add}
          placeholder={placeholder}
          className="min-w-[120px] flex-1 border-none bg-transparent text-sm focus:outline-none"
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Multi-checkbox primitive                                                    */
/* -------------------------------------------------------------------------- */

function MultiCheck({
  options,
  values,
  onChange,
  layout = "wrap",
}: {
  options: Array<{ id: string; label: string; hint?: string; emoji?: string }>;
  values: string[];
  onChange: (next: string[]) => void;
  layout?: "wrap" | "grid";
}) {
  const toggle = (id: string) => {
    if (values.includes(id)) onChange(values.filter((v) => v !== id));
    else onChange([...values, id]);
  };
  return (
    <div className={layout === "grid" ? "grid grid-cols-2 gap-2 sm:grid-cols-3" : "flex flex-wrap gap-2"}>
      {options.map((o) => {
        const on = values.includes(o.id);
        return (
          <button
            type="button"
            key={o.id}
            onClick={() => toggle(o.id)}
            className={
              "rounded-xl border px-3 py-2 text-left text-xs transition-colors " +
              (on
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-300 bg-white text-gray-700 hover:border-gray-500")
            }
          >
            <div className="font-medium">
              {o.emoji ? `${o.emoji} ` : ""}
              {o.label}
            </div>
            {o.hint ? (
              <div className={on ? "mt-0.5 text-[10px] text-white/70" : "mt-0.5 text-[10px] text-gray-500"}>
                {o.hint}
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Image upload field                                                          */
/* -------------------------------------------------------------------------- */

function ImageUploadField({
  personaId,
  slot,
  url,
  onChange,
}: {
  personaId: string;
  slot: "avatar" | "gallery";
  url: string;
  onChange: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!personaId.trim()) {
      setErr("Vul eerst een persona-ID in (bovenaan).");
      return;
    }
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    fd.append("file", f);
    fd.append("persona_id", personaId);
    fd.append("slot", slot);
    try {
      const res = await fetch("/api/admin/personas/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || !json.url) {
        throw new Error(json.error ?? "Upload faalde");
      }
      onChange(json.url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {url ? (
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100 ring-1 ring-black/5">
            <Image src={url} alt="" fill sizes="64px" className="object-cover" />
          </div>
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-xs text-gray-400">
            geen
          </div>
        )}
        <div className="flex flex-1 flex-col gap-2">
          {input({
            type: "url",
            value: url,
            onChange: (e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value),
            placeholder: "https://… (plak URL of upload)",
          })}
          <div className="flex items-center gap-2">
            <label className="cursor-pointer rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-gray-500">
              {busy ? "Uploaden…" : "Upload bestand"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={busy}
                onChange={handleFile}
                className="hidden"
              />
            </label>
            {url ? (
              <button
                type="button"
                onClick={() => onChange("")}
                className="text-xs text-gray-500 hover:text-gray-900"
              >
                wissen
              </button>
            ) : null}
          </div>
        </div>
      </div>
      {err ? <p className="text-xs text-red-600">{err}</p> : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main form                                                                   */
/* -------------------------------------------------------------------------- */

export type PersonaFormProps = {
  mode: "create" | "edit";
  initial: PersonaFormValues;
  /** Locked when editing — admins shouldn't rename a persona via the UI. */
  idLocked?: boolean;
};

export function PersonaForm({ mode, initial, idLocked }: PersonaFormProps) {
  const router = useRouter();
  const [v, setV] = useState<PersonaFormValues>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [testPhotoUrl, setTestPhotoUrl] = useState<string | null>(null);
  const [testBusy, setTestBusy] = useState(false);
  const [testErr, setTestErr] = useState<string | null>(null);

  const set = <K extends keyof PersonaFormValues>(key: K, val: PersonaFormValues[K]) => {
    setV((prev) => ({ ...prev, [key]: val }));
  };
  const setChat = <K extends keyof ChatStyleForm>(key: K, val: ChatStyleForm[K]) =>
    setV((prev) => ({ ...prev, chat_style: { ...prev.chat_style, [key]: val } }));
  const setPhoto = <K extends keyof PhotoStyleForm>(key: K, val: PhotoStyleForm[K]) =>
    setV((prev) => ({ ...prev, photo_style: { ...prev.photo_style, [key]: val } }));
  const setMeta = <K extends keyof PersonaMetaForm>(key: K, val: PersonaMetaForm[K]) =>
    setV((prev) => ({ ...prev, persona_meta: { ...prev.persona_meta, [key]: val } }));

  // When name changes and id is empty (create only), auto-suggest a slug.
  function handleNameChange(name: string) {
    setV((prev) => {
      const next = { ...prev, display_name: name };
      if (mode === "create" && !prev.id) {
        next.id = slugify(name);
      }
      return next;
    });
  }

  function buildPayload(): Record<string, unknown> {
    return {
      ...v,
      chat_style: {
        ...v.chat_style,
        reply_length: v.chat_style.reply_length || undefined,
        punctuation: v.chat_style.punctuation || undefined,
      },
      photo_style: {
        ...v.photo_style,
        seed: v.photo_style.seed.trim() ? Number(v.photo_style.seed) : undefined,
      },
      persona_meta: { ...v.persona_meta },
    };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const url =
        mode === "create"
          ? "/api/admin/personas"
          : `/api/admin/personas/${encodeURIComponent(v.id)}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `Opslaan faalde (${res.status})`);
      router.push("/admin/personas");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleArchive() {
    if (mode !== "edit") return;
    if (!confirm("Persona archiveren? Ze verdwijnt uit discovery en home.")) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/personas/${encodeURIComponent(v.id)}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `Archiveren faalde (${res.status})`);
      router.push("/admin/personas");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerateTestPhoto() {
    setTestErr(null);
    setTestBusy(true);
    try {
      const res = await fetch("/api/admin/personas/test-photo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profile: {
            id: v.id || "preview",
            display_name: v.display_name || "Persona",
            age: v.age,
            city: v.city,
            photo_style: {
              appearance: v.photo_style.appearance || undefined,
              build: v.photo_style.build || undefined,
              style: v.photo_style.style || undefined,
              vibe: v.photo_style.vibe || undefined,
              seed: v.photo_style.seed.trim() ? Number(v.photo_style.seed) : undefined,
            },
          },
          scene: "casual selfie thuis op de bank, zachte avondverlichting",
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.url) throw new Error(json.error ?? "Foto-generatie faalde");
      setTestPhotoUrl(json.url);
    } catch (e) {
      setTestErr(e instanceof Error ? e.message : String(e));
    } finally {
      setTestBusy(false);
    }
  }

  const filterTagOptions = useMemo(() => FILTER_TAG_OPTIONS, []);
  const vibeOptions = useMemo(
    () =>
      FUNNEL_VIBES.map((v) => ({
        id: v.id,
        label: v.label,
        emoji: v.emoji,
        hint: v.category,
      })),
    [],
  );
  const lookingForOptions = useMemo(
    () => FUNNEL_LOOKING_FOR.map((o) => ({ id: o.id, label: o.label, emoji: o.emoji, hint: o.description })),
    [],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pb-24">
      {/* Section 1: Identity & photos */}
      <Section
        title="1. Identiteit & foto's"
        description="Zo ziet ze eruit op cards en op haar profielpagina."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="ID (slug)" hint="alleen kleine letters, cijfers, _ en -">
            {input({
              value: v.id,
              onChange: (e: ChangeEvent<HTMLInputElement>) => set("id", slugify(e.target.value)),
              placeholder: "bv. anouk",
              disabled: idLocked,
              maxLength: 40,
            })}
          </Field>
          <Field label="Naam" hint="zoals zichtbaar in de app">
            {input({
              value: v.display_name,
              onChange: (e: ChangeEvent<HTMLInputElement>) => handleNameChange(e.target.value),
              placeholder: "Anouk",
              maxLength: 60,
            })}
          </Field>
          <Field label="Leeftijd">
            {input({
              type: "number",
              min: 18,
              max: 99,
              value: v.age,
              onChange: (e: ChangeEvent<HTMLInputElement>) => set("age", Math.max(18, Math.min(99, Number(e.target.value) || 0))),
            })}
          </Field>
          <Field label="Stad">
            {input({
              value: v.city,
              onChange: (e: ChangeEvent<HTMLInputElement>) => set("city", e.target.value),
              placeholder: "Amsterdam",
              maxLength: 80,
            })}
          </Field>
          <Field label="Beroep" hint="natuurlijk, in NL — bv. 'planner bij een bureau'">
            {input({
              value: v.occupation,
              onChange: (e: ChangeEvent<HTMLInputElement>) => set("occupation", e.target.value),
              placeholder: "marketing planner",
              maxLength: 200,
            })}
          </Field>
          <Field label="Afstand (km)" hint="alleen cosmetisch op de funnel-card">
            {input({
              type: "number",
              min: 0,
              max: 200,
              value: v.distance_km,
              onChange: (e: ChangeEvent<HTMLInputElement>) => set("distance_km", Number(e.target.value) || 0),
            })}
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-3 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={v.verified}
              onChange={(e) => set("verified", e.target.checked)}
            />
            <span>Verified-badge tonen</span>
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={v.online_now}
              onChange={(e) => set("online_now", e.target.checked)}
            />
            <span>Online-now-stip tonen</span>
          </label>
        </div>

        <Field label="Avatar (hero op cards)">
          <ImageUploadField
            personaId={v.id}
            slot="avatar"
            url={v.avatar_url}
            onChange={(u) => set("avatar_url", u)}
          />
        </Field>

        <Field label="Galerij (extra foto's op profielpagina)">
          <div className="space-y-3">
            {v.gallery_urls.map((u, i) => (
              <div key={`${u}-${i}`} className="flex items-center gap-3">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100 ring-1 ring-black/5">
                  {u ? <Image src={u} alt="" fill sizes="64px" className="object-cover" /> : null}
                </div>
                {input({
                  type: "url",
                  value: u,
                  onChange: (e: ChangeEvent<HTMLInputElement>) => {
                    const next = v.gallery_urls.slice();
                    next[i] = e.target.value;
                    set("gallery_urls", next);
                  },
                })}
                <button
                  type="button"
                  onClick={() => set("gallery_urls", v.gallery_urls.filter((_, idx) => idx !== i))}
                  className="text-xs text-gray-500 hover:text-red-600"
                >
                  ×
                </button>
              </div>
            ))}
            <ImageUploadField
              personaId={v.id}
              slot="gallery"
              url=""
              onChange={(u) => {
                if (u) set("gallery_urls", [...v.gallery_urls, u]);
              }}
            />
          </div>
        </Field>
      </Section>

      {/* Section 2: Bio + interests (cards & match-engine) */}
      <Section
        title="2. Bio & interesses"
        description="Wat op cards staat en wat de match-engine matcht. Bio drijft ook de eerste indruk in haar systeemprompt."
      >
        <Field label="Bio" hint="kort, 1–3 zinnen, voelt als haar profiel">
          {textarea({
            rows: 3,
            value: v.bio,
            onChange: (e: ChangeEvent<HTMLTextAreaElement>) => set("bio", e.target.value),
            maxLength: 800,
            placeholder:
              "Soft & warm — koffie, boeken en goede gesprekken. Niet hier voor games. Vertel me iets oprechts.",
          })}
        </Field>
        <Field label="Wat ze zoekt" hint="één regeltje, zichtbaar onder bio op profiel">
          {input({
            value: v.looking_for,
            onChange: (e: ChangeEvent<HTMLInputElement>) => set("looking_for", e.target.value),
            placeholder: "Meaningful connection",
            maxLength: 200,
          })}
        </Field>

        <Field label="Interesses (label + icoon)" hint="getoond als chips op profielpagina">
          <div className="space-y-2">
            {v.interests.map((it, i) => (
              <div key={i} className="flex items-center gap-2">
                {input({
                  value: it.label,
                  onChange: (e: ChangeEvent<HTMLInputElement>) => {
                    const next = v.interests.slice();
                    next[i] = { ...next[i], label: e.target.value };
                    set("interests", next);
                  },
                  placeholder: "Caring",
                  maxLength: 32,
                  className: "flex-1",
                })}
                <select
                  value={it.icon}
                  onChange={(e) => {
                    const next = v.interests.slice();
                    next[i] = { ...next[i], icon: e.target.value };
                    set("interests", next);
                  }}
                  className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm"
                >
                  {ICON_OPTIONS.map((ic) => (
                    <option key={ic} value={ic}>
                      {ic}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => set("interests", v.interests.filter((_, idx) => idx !== i))}
                  className="text-xs text-gray-500 hover:text-red-600"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => set("interests", [...v.interests, { label: "", icon: "warm" }])}
              className="rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-gray-500"
            >
              + interesse
            </button>
          </div>
        </Field>

        <Field label="Vibes" hint="funnel step-3 — gebruikt voor match%">
          <MultiCheck
            options={vibeOptions}
            values={v.vibe_tags}
            onChange={(next) => set("vibe_tags", next)}
            layout="grid"
          />
        </Field>

        <Field label="Open voor (looking_for)" hint="funnel step-2 — boost in step-6 grid">
          <MultiCheck
            options={lookingForOptions}
            values={v.funnel_intent_ids}
            onChange={(next) => set("funnel_intent_ids", next)}
          />
        </Field>

        <Field label="Filter-tags" hint="bepaalt in welke filter-tabs op berichten ze zichtbaar is">
          <MultiCheck
            options={filterTagOptions}
            values={v.filter_tags}
            onChange={(next) => set("filter_tags", next)}
          />
        </Field>
      </Section>

      {/* Section 3: Status & discovery */}
      <Section
        title="3. Status & discovery-positie"
        description="Hoe ze ranged op home en welk badge ze krijgt."
        defaultOpen={false}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Status-variant">
            <select
              value={v.status_variant}
              onChange={(e) => set("status_variant", e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.id}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status-label" hint="zichtbaar onder profiel">
            {input({
              value: v.status_label,
              onChange: (e: ChangeEvent<HTMLInputElement>) => set("status_label", e.target.value),
            })}
          </Field>
          <Field label="Last-active label" hint="bv. 'Active today', 'Just now'">
            {input({
              value: v.last_active_label,
              onChange: (e: ChangeEvent<HTMLInputElement>) => set("last_active_label", e.target.value),
            })}
          </Field>
          <Field label="Home sort-volgorde" hint="lager = hoger in de grid (1–6 bovenaan)">
            {input({
              type: "number",
              min: 1,
              max: 9999,
              value: v.home_sort,
              onChange: (e: ChangeEvent<HTMLInputElement>) => set("home_sort", Number(e.target.value) || 100),
            })}
          </Field>
          <Field label="Joined-at" hint="ISO datum, default = nu">
            {input({
              type: "datetime-local",
              value: v.joined_at ? new Date(v.joined_at).toISOString().slice(0, 16) : "",
              onChange: (e: ChangeEvent<HTMLInputElement>) => {
                const t = e.target.value;
                set("joined_at", t ? new Date(t).toISOString() : new Date().toISOString());
              },
            })}
          </Field>
        </div>
      </Section>

      {/* Section 4: Persona depth */}
      <Section
        title="4. Persona-diepte"
        description="Voedt de AI-systeemprompt: hoe ze écht is, haar leven, haar dromen, haar grenzen."
      >
        <Field label="Backstory" hint="2–4 alinea's: jeugd, familie, recent jaar, huidige hoofdstuk">
          {textarea({
            rows: 8,
            value: v.backstory,
            onChange: (e: ChangeEvent<HTMLTextAreaElement>) => set("backstory", e.target.value),
            maxLength: 4000,
            placeholder:
              "Ze is opgegroeid in Brabant, oudste van twee. Studeerde marketing in Tilburg, woont nu sinds twee jaar in een klein appartement aan de Singel. Werkt als planner bij een bureau, vindt het werk leuk maar zoekt iets dat meer op haar lijkt. Recent uit een relatie van drie jaar — kalm, vriendschappelijk geëindigd. Houdt van tweedehands boeken, lange wandelingen langs de gracht, en heeft een kat (Pluis).",
          })}
        </Field>

        <Field label="Persoonlijkheidstrekken" hint="adjectives die haar reacties consistent sturen">
          <ChipList
            values={v.persona_meta.personality_traits}
            onChange={(next) => setMeta("personality_traits", next)}
            placeholder="empatisch, nieuwsgierig, …"
          />
        </Field>

        <Field label="Dagritme" hint="natuurlijk te benoemen: 'net van de gym', 'douche scene'">
          {textarea({
            rows: 3,
            value: v.persona_meta.daily_rhythm,
            onChange: (e: ChangeEvent<HTMLTextAreaElement>) => setMeta("daily_rhythm", e.target.value),
            maxLength: 800,
            placeholder:
              "Vroeg op rond 07:00, koffie en een korte wandeling. Werkt 9–17. Sport 3x/week na werk. 's avonds graag op de bank met een serie. Slaap rond 23:30.",
          })}
        </Field>

        <Field label="Doelen / dromen">
          <ChipList
            values={v.persona_meta.goals}
            onChange={(next) => setMeta("goals", next)}
            placeholder="career switch maken, eigen plek met tuin, …"
          />
        </Field>

        <Field label="Relatieverleden-hint" hint="alleen als gesprek serieus wordt; nooit ongevraagd opbrengen">
          {textarea({
            rows: 3,
            value: v.persona_meta.relationship_hint,
            onChange: (e: ChangeEvent<HTMLTextAreaElement>) => setMeta("relationship_hint", e.target.value),
            maxLength: 600,
            placeholder:
              "Recent uit een relatie van drie jaar; ze leerde dat ze meer ruimte voor zichzelf wil maar niet bang is voor diepte.",
          })}
        </Field>

        <Field label="Koosnamen die zij zou gebruiken" hint="alleen wanneer relatie er klaar voor is">
          <ChipList
            values={v.persona_meta.pet_names}
            onChange={(next) => setMeta("pet_names", next)}
            placeholder="schat, gekkie, …"
          />
        </Field>

        <Field label="Talen">
          <ChipList
            values={v.persona_meta.languages}
            onChange={(next) => setMeta("languages", next)}
            placeholder="nl, en, …"
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Tijdzone" hint="IANA — bv. Europe/Amsterdam">
            {input({
              value: v.persona_meta.timezone,
              onChange: (e: ChangeEvent<HTMLInputElement>) => setMeta("timezone", e.target.value),
              placeholder: "Europe/Amsterdam",
            })}
          </Field>
          <Field label="Stem-stijl" hint="overflow van chat-style — bv. 'kort en speels'">
            {input({
              value: v.persona_meta.voice_style,
              onChange: (e: ChangeEvent<HTMLInputElement>) => setMeta("voice_style", e.target.value),
              placeholder: "kort en speels",
            })}
          </Field>
        </div>
      </Section>

      {/* Section 5: Chat style */}
      <Section
        title="5. Chat-stijl"
        description="Hoe ze tikt: tics, emoji, ritme, dingen die ze liever niet bespreekt."
        defaultOpen={false}
      >
        <Field label="Verbale tics" hint="laat 1× per ~5 berichten subtiel vallen">
          <ChipList
            values={v.chat_style.verbal_tics}
            onChange={(next) => setChat("verbal_tics", next)}
            placeholder="joh, ofzo, echt waar, …"
          />
        </Field>
        <Field label="Emoji-palet" hint="2–5 favoriete emoji">
          <ChipList
            values={v.chat_style.emoji_palette}
            onChange={(next) => setChat("emoji_palette", next)}
            placeholder="🙈 🥹 😅"
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Antwoord-lengte">
            <select
              value={v.chat_style.reply_length}
              onChange={(e) => setChat("reply_length", e.target.value as ChatStyleForm["reply_length"])}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="short">short</option>
              <option value="medium">medium</option>
              <option value="variable">variable</option>
            </select>
          </Field>
          <Field label="Punctuatie">
            <select
              value={v.chat_style.punctuation}
              onChange={(e) => setChat("punctuation", e.target.value as ChatStyleForm["punctuation"])}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="casual">casual (drops dots, lowercase)</option>
              <option value="clean">clean</option>
            </select>
          </Field>
        </div>
        <Field label="Quirks">
          <ChipList
            values={v.chat_style.quirks}
            onChange={(next) => setChat("quirks", next)}
            placeholder="luistert dezelfde 4 nummers tot ze ze haat, …"
          />
        </Field>
        <Field label="Bespreekt liever niet">
          <ChipList
            values={v.chat_style.talks_less_about}
            onChange={(next) => setChat("talks_less_about", next)}
            placeholder="familie, vorige relatie, …"
          />
        </Field>
      </Section>

      {/* Section 6: Photo style */}
      <Section
        title="6. Foto-stijl (Z-Image-Turbo)"
        description="Hoe ze er consistent uit moet zien als de AI foto's stuurt. Vul concreet in."
        defaultOpen={false}
      >
        <Field label="Uiterlijk" hint="haar, ogen, sproetjes, glimlach — 1–2 zinnen">
          {textarea({
            rows: 3,
            value: v.photo_style.appearance,
            onChange: (e: ChangeEvent<HTMLTextAreaElement>) => setPhoto("appearance", e.target.value),
            maxLength: 600,
            placeholder:
              "natuurlijke schoonheid, 26-jarige Nederlandse vrouw, blond half-knot, lichtbruine ogen, lichte sproetjes, zachte glimlach",
          })}
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Lichaamsbouw">
            {input({
              value: v.photo_style.build,
              onChange: (e: ChangeEvent<HTMLInputElement>) => setPhoto("build", e.target.value),
              placeholder: "slank, gemiddelde lengte",
            })}
          </Field>
          <Field label="Stijl / outfit">
            {input({
              value: v.photo_style.style,
              onChange: (e: ChangeEvent<HTMLInputElement>) => setPhoto("style", e.target.value),
              placeholder: "soft girl, denim, oversized sweaters",
            })}
          </Field>
          <Field label="Vibe in foto's">
            {input({
              value: v.photo_style.vibe,
              onChange: (e: ChangeEvent<HTMLInputElement>) => setPhoto("vibe", e.target.value),
              placeholder: "warm, een beetje verlegen, candid",
            })}
          </Field>
          <Field label="Seed" hint="vast getal voor consistentie (laat leeg = afgeleid van id)">
            {input({
              type: "number",
              value: v.photo_style.seed,
              onChange: (e: ChangeEvent<HTMLInputElement>) => setPhoto("seed", e.target.value),
              placeholder: "bv. 12345",
            })}
          </Field>
        </div>

        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-800">Test-foto genereren</p>
              <p className="text-xs text-gray-500">
                Gebruikt huidige foto-stijl. Beeld komt in chat-images bucket; je kunt de URL als avatar plakken.
              </p>
            </div>
            <button
              type="button"
              onClick={handleGenerateTestPhoto}
              disabled={testBusy}
              className="shrink-0 rounded-full bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-black disabled:opacity-50"
            >
              {testBusy ? "Genereren…" : "Genereer test-foto"}
            </button>
          </div>
          {testErr ? <p className="mt-2 text-xs text-red-600">{testErr}</p> : null}
          {testPhotoUrl ? (
            <div className="mt-3 flex items-center gap-3">
              <div className="relative h-32 w-24 overflow-hidden rounded-xl bg-gray-100 ring-1 ring-black/5">
                <Image src={testPhotoUrl} alt="" fill sizes="96px" className="object-cover" />
              </div>
              <div className="flex flex-col gap-2">
                <input
                  readOnly
                  value={testPhotoUrl}
                  className="w-[420px] max-w-full rounded-lg border border-gray-200 bg-white px-2 py-1 text-[10px] text-gray-700"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => set("avatar_url", testPhotoUrl)}
                    className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs hover:border-gray-500"
                  >
                    Gebruik als avatar
                  </button>
                  <button
                    type="button"
                    onClick={() => set("gallery_urls", [...v.gallery_urls, testPhotoUrl])}
                    className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs hover:border-gray-500"
                  >
                    Voeg toe aan galerij
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </Section>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 border-t border-black/5 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-6 py-3">
          <div className="text-xs text-gray-600">
            {err ? <span className="text-red-600">{err}</span> : <span>Wijzigingen worden pas live na opslaan.</span>}
          </div>
          <div className="flex items-center gap-2">
            {mode === "edit" ? (
              <button
                type="button"
                onClick={handleArchive}
                disabled={busy}
                className="rounded-full border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                Archiveer
              </button>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-gray-900 px-5 py-2 text-xs font-semibold text-white hover:bg-black disabled:opacity-50"
            >
              {busy ? "Opslaan…" : mode === "create" ? "Persona aanmaken" : "Wijzigingen opslaan"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
