"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { FUNNEL_LOOKING_FOR, FUNNEL_VIBES } from "@/data/funnel";
import {
  ArchiveIcon,
  BookIcon,
  CompassIcon,
  HeartIcon,
  IdIcon,
  MicIcon,
  PaletteIcon,
  PlusIcon,
  SparkleIcon,
  XIcon,
} from "@/components/admin/icons";
import {
  Field,
  TextInput,
  TextArea,
  Select,
  Checkbox,
  ChipList,
  MultiCheck,
} from "./primitives";
import { ImageUploadField } from "./image-upload-field";
import { WorkScheduleBadge } from "@/components/admin/work-schedule-badge";
import { PersonaSectionCard, PersonaSectionNav, type SectionDef } from "./section-nav";
import {
  slugify,
  FILTER_TAG_OPTIONS,
  STATUS_OPTIONS,
  ICON_OPTIONS,
  type ChatStyleForm,
  type PersonaFormValues,
  type PersonaMetaForm,
  type PhotoStyleForm,
} from "./types";

// Note: server pages must import `emptyPersonaFormValues` and the
// `PersonaFormValues` type directly from "./types" (no "use client"),
// not via this barrel — re-exporting them from this client module would
// turn the function into a client-side proxy and crash during SSR.

const SECTIONS: SectionDef[] = [
  { id: "identity", number: 1, label: "Identiteit & foto's", icon: <IdIcon className="h-4 w-4" /> },
  { id: "bio", number: 2, label: "Bio & interesses", icon: <HeartIcon className="h-4 w-4" /> },
  { id: "discovery", number: 3, label: "Status & discovery", icon: <CompassIcon className="h-4 w-4" /> },
  { id: "depth", number: 4, label: "Persona-diepte", icon: <BookIcon className="h-4 w-4" /> },
  { id: "chat", number: 5, label: "Chat-stijl", icon: <MicIcon className="h-4 w-4" /> },
  { id: "photo", number: 6, label: "Foto-stijl", icon: <PaletteIcon className="h-4 w-4" /> },
];

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
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [galleryProgress, setGalleryProgress] = useState<{ done: number; total: number } | null>(null);
  const [galleryErr, setGalleryErr] = useState<string | null>(null);

  const [nudeBusy, setNudeBusy] = useState(false);
  const [nudeProgress, setNudeProgress] = useState<{ done: number; total: number } | null>(null);
  const [nudeErr, setNudeErr] = useState<string | null>(null);

  const set = <K extends keyof PersonaFormValues>(key: K, val: PersonaFormValues[K]) => {
    setV((prev) => ({ ...prev, [key]: val }));
  };
  const setChat = <K extends keyof ChatStyleForm>(key: K, val: ChatStyleForm[K]) =>
    setV((prev) => ({ ...prev, chat_style: { ...prev.chat_style, [key]: val } }));
  const setPhoto = <K extends keyof PhotoStyleForm>(key: K, val: PhotoStyleForm[K]) =>
    setV((prev) => ({ ...prev, photo_style: { ...prev.photo_style, [key]: val } }));
  const setMeta = <K extends keyof PersonaMetaForm>(key: K, val: PersonaMetaForm[K]) =>
    setV((prev) => ({ ...prev, persona_meta: { ...prev.persona_meta, [key]: val } }));

  function handleNameChange(name: string) {
    setV((prev) => {
      const next = { ...prev, display_name: name };
      if (mode === "create" && !prev.id) next.id = slugify(name);
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
        attractiveness: v.photo_style.attractiveness || undefined,
        body_type: v.photo_style.body_type || undefined,
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
    if (!confirm("Persona archiveren? Ze verdwijnt uit discovery en home, maar haar data en chats blijven bewaard.")) return;
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

  async function handleGenerateGalleryPhotos(count = 3) {
    if (!v.id || mode !== "edit") return;
    setGalleryErr(null);
    setGalleryBusy(true);
    setGalleryProgress({ done: 0, total: count });
    const offset = Math.floor(Math.random() * 1000);
    let lastError: string | null = null;
    let success = 0;
    for (let i = 0; i < count; i++) {
      try {
        const res = await fetch(
          `/api/admin/personas/${encodeURIComponent(v.id)}/append-gallery-photo`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ variant: offset + i }),
          },
        );
        const data: {
          ok?: boolean;
          gallery_url?: string;
          gallery_urls?: string[];
          error?: string;
        } = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok || !data.gallery_url) {
          lastError = data.error ?? `HTTP ${res.status}`;
          continue;
        }
        success += 1;
        setGalleryProgress({ done: success, total: count });
        if (Array.isArray(data.gallery_urls)) {
          set("gallery_urls", data.gallery_urls);
        } else {
          set("gallery_urls", [...v.gallery_urls, data.gallery_url]);
        }
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
      }
    }
    if (success === 0 && lastError) setGalleryErr(lastError);
    else if (success < count && lastError)
      setGalleryErr(`${success}/${count} gelukt — laatste fout: ${lastError}`);
    setGalleryBusy(false);
    router.refresh();
  }

  /** Generate exactly 3 explicit nude photos for this persona.
   *  Uses strong explicit scene descriptions so the prompt builder triggers
   *  full-frontal nudity + self-taken mirror selfie styling.
   */
  async function handleGenerateNudePhotos() {
    if (!v.id || mode !== "edit") return;
    setNudeErr(null);
    setNudeBusy(true);
    setNudeProgress({ done: 0, total: 3 });

    const NUDE_SCENES = [
      "naakte spiegel selfie in slaapkamer, staand, telefoon in eigen hand, borsten en kutje volledig zichtbaar, amateur self-taken, real personal photo",
      "naakte spiegel selfie liggend op bed met knieën opgetrokken en benen gespreid, kutje en borsten close-up, zacht natuurlijk licht, self-taken",
      "naakte badkamer spiegel selfie staand op tenen, telefoon laag gehouden, borsten en kont zichtbaar, real amateur self-taken photo",
    ];

    let lastError: string | null = null;
    let success = 0;

    for (let i = 0; i < 3; i++) {
      try {
        const res = await fetch(
          `/api/admin/personas/${encodeURIComponent(v.id)}/append-gallery-photo`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              scene: NUDE_SCENES[i],
              variant: 9000 + i, // high offset so it doesn't collide with normal variants
            }),
          },
        );
        const data: {
          ok?: boolean;
          gallery_url?: string;
          gallery_urls?: string[];
          error?: string;
        } = await res.json().catch(() => ({}));

        if (!res.ok || !data.ok || !data.gallery_url) {
          lastError = data.error ?? `HTTP ${res.status}`;
          continue;
        }

        success += 1;
        setNudeProgress({ done: success, total: 3 });

        if (Array.isArray(data.gallery_urls)) {
          set("gallery_urls", data.gallery_urls);
        } else {
          set("gallery_urls", [...v.gallery_urls, data.gallery_url]);
        }
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
      }
    }

    if (success === 0 && lastError) setNudeErr(lastError);
    else if (success < 3 && lastError)
      setNudeErr(`${success}/3 gelukt — laatste fout: ${lastError}`);

    setNudeBusy(false);
    router.refresh();
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
              attractiveness: v.photo_style.attractiveness || undefined,
              body_type: v.photo_style.body_type || undefined,
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

  const vibeOptions = useMemo(
    () => FUNNEL_VIBES.map((o) => ({ id: o.id, label: o.label, emoji: o.emoji, hint: o.category })),
    [],
  );
  const lookingForOptions = useMemo(
    () =>
      FUNNEL_LOOKING_FOR.map((o) => ({
        id: o.id,
        label: o.label,
        emoji: o.emoji,
        hint: o.description,
      })),
    [],
  );

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-6 pb-28 lg:grid-cols-[220px_minmax(0,1fr)]"
    >
      <PersonaSectionNav sections={SECTIONS} />

      <div className="min-w-0 space-y-6">
        {/* SECTION 1: Identity & photos */}
        <PersonaSectionCard
          id="identity"
          number={1}
          title="Identiteit & foto's"
          description="Zoals ze verschijnt op cards en haar profielpagina."
          icon={<IdIcon className="h-5 w-5" />}
        >
          <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
            <Field label="Avatar" hint="hero op cards" required>
              <ImageUploadField
                personaId={v.id}
                slot="avatar"
                url={v.avatar_url}
                onChange={(u) => set("avatar_url", u)}
                variant="tile"
              />
            </Field>
            <div className="grid gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Naam" required>
                  <TextInput
                    value={v.display_name}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => handleNameChange(e.target.value)}
                    placeholder="Anouk"
                    maxLength={60}
                  />
                </Field>
                <Field label="ID (slug)" hint="kleine letters / cijfers / _ -" required>
                  <TextInput
                    value={v.id}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => set("id", slugify(e.target.value))}
                    placeholder="bv. anouk"
                    disabled={idLocked}
                    maxLength={40}
                  />
                </Field>
                <Field label="Leeftijd" required>
                  <TextInput
                    type="number"
                    min={18}
                    max={99}
                    value={v.age}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      set("age", Math.max(18, Math.min(99, Number(e.target.value) || 0)))
                    }
                  />
                </Field>
                <Field label="Stad">
                  <TextInput
                    value={v.city}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => set("city", e.target.value)}
                    placeholder="Amsterdam"
                    maxLength={80}
                  />
                </Field>
                <Field label="Beroep" hint="bv. 'planner bij een bureau'">
                  <TextInput
                    value={v.occupation}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => set("occupation", e.target.value)}
                    placeholder="marketing planner"
                    maxLength={200}
                  />
                </Field>
                <Field label="Afstand (km)" hint="cosmetisch op funnel-card">
                  <TextInput
                    type="number"
                    min={0}
                    max={200}
                    value={v.distance_km}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      set("distance_km", Number(e.target.value) || 0)
                    }
                  />
                </Field>
              </div>

              <WorkScheduleBadge occupation={v.occupation} />

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Checkbox
                  label="Verified-badge tonen"
                  description="Blauw vinkje bij naam"
                  checked={v.verified}
                  onChange={(b) => set("verified", b)}
                />
                <Checkbox
                  label="Online-stip tonen"
                  description="Groene puls op de avatar"
                  checked={v.online_now}
                  onChange={(b) => set("online_now", b)}
                />
              </div>
            </div>
          </div>

          <Field label="Galerij" hint="extra foto's op haar profielpagina (min. 3 aanbevolen)">
            <div className="space-y-3">
              {v.gallery_urls.length === 0 ? (
                <p className="text-xs text-gray-400">
                  Nog geen foto's. Voeg minimaal 3 toe — dating-app cards voelen leeg
                  zonder galerij.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {v.gallery_urls.map((u, i) => (
                    <div
                      key={`${u}-${i}`}
                      className="group relative aspect-[3/4] overflow-hidden rounded-xl bg-gray-100 ring-1 ring-black/5"
                    >
                      {u ? <Image src={u} alt="" fill sizes="200px" className="object-cover" /> : null}
                      <button
                        type="button"
                        onClick={() => set("gallery_urls", v.gallery_urls.filter((_, idx) => idx !== i))}
                        className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity backdrop-blur-sm group-hover:opacity-100 hover:bg-black/70"
                        aria-label="verwijder foto"
                      >
                        <XIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {mode === "edit" && v.id ? (
                <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-lavender/30 to-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-gray-900">
                        <SparkleIcon className="h-3.5 w-3.5 text-primary" />
                        AI-galerij genereren
                      </p>
                      <p className="mt-0.5 text-[11px] text-gray-600">
                        Gebruikt haar foto-stijl + seed, zodat alle galerij-foto's
                        van dezelfde persoon zijn maar in andere settings (full-body,
                        candid, activiteit). ~10-30s per foto.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleGenerateGalleryPhotos(3)}
                      disabled={galleryBusy}
                      className="shrink-0 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white shadow-pill transition-all hover:bg-primarySoft disabled:opacity-50"
                    >
                      {galleryBusy
                        ? `Genereren… ${galleryProgress?.done ?? 0}/${galleryProgress?.total ?? 3}`
                        : "Genereer 3 extra foto's"}
                    </button>

                    <button
                      type="button"
                      onClick={handleGenerateNudePhotos}
                      disabled={nudeBusy || galleryBusy}
                      className="shrink-0 rounded-xl bg-rose-600 px-3 py-2 text-xs font-semibold text-white shadow-pill transition-all hover:bg-rose-700 disabled:opacity-50"
                      title="Genereert 3 expliciete naaktfoto's (spiegel selfies, full frontal). Wordt automatisch aan de galerij toegevoegd."
                    >
                      {nudeBusy
                        ? `Naakt… ${nudeProgress?.done ?? 0}/3`
                        : "Genereer 3 naaktfoto's"}
                    </button>
                  </div>
                  {galleryErr ? (
                    <p className="mt-2 text-[11px] text-rose-600">{galleryErr}</p>
                  ) : null}
                  {nudeErr ? (
                    <p className="mt-2 text-[11px] text-rose-600">{nudeErr}</p>
                  ) : null}
                </div>
              ) : null}

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
        </PersonaSectionCard>

        {/* SECTION 2: Bio & interests */}
        <PersonaSectionCard
          id="bio"
          number={2}
          title="Bio & interesses"
          description="Wat zichtbaar is op cards en hoe de match-engine haar matched. De bio drijft ook de eerste indruk in de AI-prompt."
          icon={<HeartIcon className="h-5 w-5" />}
        >
          <Field label="Bio" hint="kort, 1–3 zinnen, voelt als haar profiel">
            <TextArea
              rows={3}
              value={v.bio}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => set("bio", e.target.value)}
              maxLength={800}
              placeholder="Soft & warm — koffie, boeken en goede gesprekken. Niet hier voor games. Vertel me iets oprechts."
            />
          </Field>

          <Field label="Wat ze zoekt" hint="één regeltje, onder bio op profiel">
            <TextInput
              value={v.looking_for}
              onChange={(e: ChangeEvent<HTMLInputElement>) => set("looking_for", e.target.value)}
              placeholder="Meaningful connection"
              maxLength={200}
            />
          </Field>

          <Field label="Interesses" hint="label + icoon, getoond als chips op profiel">
            <div className="space-y-2">
              {v.interests.map((it, i) => (
                <div key={i} className="flex items-center gap-2">
                  <TextInput
                    value={it.label}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      const next = v.interests.slice();
                      next[i] = { ...next[i], label: e.target.value };
                      set("interests", next);
                    }}
                    placeholder="Caring"
                    maxLength={32}
                    className="flex-1"
                  />
                  <Select
                    value={it.icon}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                      const next = v.interests.slice();
                      next[i] = { ...next[i], icon: e.target.value };
                      set("interests", next);
                    }}
                    className="w-32"
                  >
                    {ICON_OPTIONS.map((ic) => (
                      <option key={ic} value={ic}>
                        {ic}
                      </option>
                    ))}
                  </Select>
                  <button
                    type="button"
                    onClick={() => set("interests", v.interests.filter((_, idx) => idx !== i))}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 hover:bg-rose-50 hover:text-rose-600"
                    aria-label="verwijder"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => set("interests", [...v.interests, { label: "", icon: "warm" }])}
                className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:border-primary hover:text-primary"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Interesse toevoegen
              </button>
            </div>
          </Field>

          <Field label="Vibes" hint="funnel step-3 — gebruikt voor match%">
            <MultiCheck options={vibeOptions} values={v.vibe_tags} onChange={(n) => set("vibe_tags", n)} layout="grid" />
          </Field>

          <Field label="Open voor" hint="funnel step-2 — boost in step-6 grid">
            <MultiCheck options={lookingForOptions} values={v.funnel_intent_ids} onChange={(n) => set("funnel_intent_ids", n)} />
          </Field>

          <Field label="Filter-tags" hint="bepaalt in welke filter-tabs op berichten ze zichtbaar is">
            <MultiCheck options={FILTER_TAG_OPTIONS} values={v.filter_tags} onChange={(n) => set("filter_tags", n)} />
          </Field>
        </PersonaSectionCard>

        {/* SECTION 3: Status & discovery */}
        <PersonaSectionCard
          id="discovery"
          number={3}
          title="Status & discovery-positie"
          description="Hoe ze ranged op home en welk badge ze krijgt."
          icon={<CompassIcon className="h-5 w-5" />}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Status-variant">
              <Select value={v.status_variant} onChange={(e: ChangeEvent<HTMLSelectElement>) => set("status_variant", e.target.value)}>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.id}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status-label" hint="zichtbaar onder profiel">
              <TextInput value={v.status_label} onChange={(e: ChangeEvent<HTMLInputElement>) => set("status_label", e.target.value)} />
            </Field>
            <Field label="Last-active label" hint="bv. 'Active today', 'Just now'">
              <TextInput value={v.last_active_label} onChange={(e: ChangeEvent<HTMLInputElement>) => set("last_active_label", e.target.value)} />
            </Field>
            <Field label="Home sort-volgorde" hint="lager = hoger (1–6 bovenaan)">
              <TextInput
                type="number"
                min={1}
                max={9999}
                value={v.home_sort}
                onChange={(e: ChangeEvent<HTMLInputElement>) => set("home_sort", Number(e.target.value) || 100)}
              />
            </Field>
            <Field label="Joined-at" hint="default = nu">
              <TextInput
                type="datetime-local"
                value={v.joined_at ? new Date(v.joined_at).toISOString().slice(0, 16) : ""}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const t = e.target.value;
                  set("joined_at", t ? new Date(t).toISOString() : new Date().toISOString());
                }}
              />
            </Field>
          </div>
        </PersonaSectionCard>

        {/* SECTION 4: Persona depth */}
        <PersonaSectionCard
          id="depth"
          number={4}
          title="Persona-diepte"
          description="Voedt de AI-systeemprompt: hoe ze écht is, haar leven, dromen, grenzen. Hoe rijker dit is, hoe authentieker de chats."
          icon={<BookIcon className="h-5 w-5" />}
        >
          <Field label="Backstory" hint="2–4 alinea's: jeugd, familie, recent jaar, huidige hoofdstuk">
            <TextArea
              rows={8}
              value={v.backstory}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => set("backstory", e.target.value)}
              maxLength={4000}
              placeholder="Ze is opgegroeid in Brabant, oudste van twee. Studeerde marketing in Tilburg, woont nu sinds twee jaar in een klein appartement aan de Singel. Werkt als planner bij een bureau, vindt het werk leuk maar zoekt iets dat meer op haar lijkt. Recent uit een relatie van drie jaar — kalm, vriendschappelijk geëindigd. Houdt van tweedehands boeken, lange wandelingen langs de gracht, en heeft een kat (Pluis)."
            />
          </Field>

          <Field label="Persoonlijkheidstrekken" hint="adjectieven die haar reacties consistent sturen">
            <ChipList values={v.persona_meta.personality_traits} onChange={(n) => setMeta("personality_traits", n)} placeholder="empatisch, nieuwsgierig, …" />
          </Field>

          <Field label="Dagritme" hint="natuurlijk te benoemen: 'net van de gym', 'douche scene'">
            <TextArea
              rows={3}
              value={v.persona_meta.daily_rhythm}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setMeta("daily_rhythm", e.target.value)}
              maxLength={800}
              placeholder="Vroeg op rond 07:00, koffie en korte wandeling. Werkt 9–17. Sport 3x/week na werk. Slaap rond 23:30."
            />
          </Field>

          <Field label="Doelen / dromen">
            <ChipList values={v.persona_meta.goals} onChange={(n) => setMeta("goals", n)} placeholder="career switch maken, eigen plek met tuin, …" />
          </Field>

          <Field label="Relatieverleden-hint" hint="alleen als gesprek serieus wordt; nooit ongevraagd opbrengen">
            <TextArea
              rows={3}
              value={v.persona_meta.relationship_hint}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setMeta("relationship_hint", e.target.value)}
              maxLength={600}
              placeholder="Recent uit een relatie van drie jaar; ze leerde dat ze meer ruimte voor zichzelf wil maar niet bang is voor diepte."
            />
          </Field>

          <Field label="Koosnamen die zij zou gebruiken" hint="alleen wanneer relatie er klaar voor is">
            <ChipList values={v.persona_meta.pet_names} onChange={(n) => setMeta("pet_names", n)} placeholder="schat, gekkie, …" />
          </Field>

          <Field label="Talen">
            <ChipList values={v.persona_meta.languages} onChange={(n) => setMeta("languages", n)} placeholder="nl, en, …" />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Tijdzone" hint="IANA — bv. Europe/Amsterdam">
              <TextInput
                value={v.persona_meta.timezone}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setMeta("timezone", e.target.value)}
                placeholder="Europe/Amsterdam"
              />
            </Field>
            <Field label="Stem-stijl" hint="overflow van chat-style — bv. 'kort en speels'">
              <TextInput
                value={v.persona_meta.voice_style}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setMeta("voice_style", e.target.value)}
                placeholder="kort en speels"
              />
            </Field>
          </div>
        </PersonaSectionCard>

        {/* SECTION 5: Chat style */}
        <PersonaSectionCard
          id="chat"
          number={5}
          title="Chat-stijl"
          description="Hoe ze tikt: tics, emoji, ritme, dingen die ze liever niet bespreekt."
          icon={<MicIcon className="h-5 w-5" />}
        >
          <Field label="Verbale tics" hint="laat 1× per ~5 berichten subtiel vallen">
            <ChipList values={v.chat_style.verbal_tics} onChange={(n) => setChat("verbal_tics", n)} placeholder="joh, ofzo, echt waar, …" />
          </Field>
          <Field label="Emoji-palet" hint="2–5 favoriete emoji">
            <ChipList values={v.chat_style.emoji_palette} onChange={(n) => setChat("emoji_palette", n)} placeholder="🙈 🥹 😅" />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Antwoord-lengte">
              <Select
                value={v.chat_style.reply_length}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setChat("reply_length", e.target.value as ChatStyleForm["reply_length"])}
              >
                <option value="short">short</option>
                <option value="medium">medium</option>
                <option value="variable">variable</option>
              </Select>
            </Field>
            <Field label="Punctuatie">
              <Select
                value={v.chat_style.punctuation}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setChat("punctuation", e.target.value as ChatStyleForm["punctuation"])}
              >
                <option value="casual">casual (drops dots, lowercase)</option>
                <option value="clean">clean</option>
              </Select>
            </Field>
          </div>
          <Field label="Quirks">
            <ChipList values={v.chat_style.quirks} onChange={(n) => setChat("quirks", n)} placeholder="luistert dezelfde 4 nummers tot ze ze haat, …" />
          </Field>
          <Field label="Bespreekt liever niet">
            <ChipList values={v.chat_style.talks_less_about} onChange={(n) => setChat("talks_less_about", n)} placeholder="familie, vorige relatie, …" />
          </Field>
        </PersonaSectionCard>

        {/* SECTION 6: Photo style */}
        <PersonaSectionCard
          id="photo"
          number={6}
          title="Foto-stijl (Z-Image-Turbo)"
          description="Hoe ze er consistent uit moet zien als de AI foto's stuurt. Concreet en specifiek werkt het beste."
          icon={<PaletteIcon className="h-5 w-5" />}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Aantrekkelijkheid"
              hint="realisme-knop — diffusion-anchors voor model-bias"
            >
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "plain", label: "Gewoon", hint: "onopvallend" },
                  { id: "average", label: "Normaal", hint: "alledaags" },
                  { id: "striking", label: "Knap", hint: "model-look" },
                ].map((opt) => {
                  const active = v.photo_style.attractiveness === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        setPhoto("attractiveness", opt.id as PhotoStyleForm["attractiveness"])
                      }
                      className={
                        "rounded-lg border px-3 py-2 text-left transition-colors " +
                        (active
                          ? "border-primary bg-primary/10 text-primary shadow-sm"
                          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300")
                      }
                    >
                      <div className="text-sm font-semibold">{opt.label}</div>
                      <div className="text-[10px] leading-tight text-gray-500">{opt.hint}</div>
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Lichaamsbouw" hint="onafhankelijk van aantrekkelijkheid">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "slim", label: "Slank", hint: "smal frame" },
                  { id: "average", label: "Normaal", hint: "gemiddeld" },
                  { id: "plus", label: "Dik", hint: "voller postuur" },
                ].map((opt) => {
                  const active = v.photo_style.body_type === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        setPhoto("body_type", opt.id as PhotoStyleForm["body_type"])
                      }
                      className={
                        "rounded-lg border px-3 py-2 text-left transition-colors " +
                        (active
                          ? "border-primary bg-primary/10 text-primary shadow-sm"
                          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300")
                      }
                    >
                      <div className="text-sm font-semibold">{opt.label}</div>
                      <div className="text-[10px] leading-tight text-gray-500">{opt.hint}</div>
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>

          <Field label="Uiterlijk" hint="haar, ogen, sproetjes, glimlach — 1–2 zinnen">
            <TextArea
              rows={3}
              value={v.photo_style.appearance}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setPhoto("appearance", e.target.value)}
              maxLength={600}
              placeholder="natuurlijke schoonheid, 26-jarige Nederlandse vrouw, blond half-knot, lichtbruine ogen, lichte sproetjes, zachte glimlach"
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Lichaamsbouw">
              <TextInput
                value={v.photo_style.build}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPhoto("build", e.target.value)}
                placeholder="slank, gemiddelde lengte"
              />
            </Field>
            <Field label="Stijl / outfit">
              <TextInput
                value={v.photo_style.style}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPhoto("style", e.target.value)}
                placeholder="soft girl, denim, oversized sweaters"
              />
            </Field>
            <Field label="Vibe in foto's">
              <TextInput
                value={v.photo_style.vibe}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPhoto("vibe", e.target.value)}
                placeholder="warm, een beetje verlegen, candid"
              />
            </Field>
            <Field label="Seed" hint="vast getal voor consistentie (leeg = afgeleid van id)">
              <TextInput
                type="number"
                value={v.photo_style.seed}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPhoto("seed", e.target.value)}
                placeholder="bv. 12345"
              />
            </Field>
          </div>

          <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-lavender/40 to-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
                  <SparkleIcon className="h-4 w-4 text-primary" />
                  Test-foto genereren
                </p>
                <p className="mt-0.5 text-xs text-gray-600">
                  Gebruikt huidige foto-stijl. Beeld komt in de chat-images bucket; je kunt de URL als avatar plakken of toevoegen aan de galerij.
                </p>
              </div>
              <button
                type="button"
                onClick={handleGenerateTestPhoto}
                disabled={testBusy}
                className="shrink-0 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-pill transition-all hover:bg-primarySoft disabled:opacity-50"
              >
                {testBusy ? "Genereren…" : "Genereer test-foto"}
              </button>
            </div>
            {testErr ? <p className="mt-3 text-xs text-rose-600">{testErr}</p> : null}
            {testPhotoUrl ? (
              <div className="mt-4 flex flex-wrap items-start gap-4">
                <div className="relative h-44 w-32 shrink-0 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5">
                  <Image src={testPhotoUrl} alt="" fill sizes="128px" className="object-cover" />
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <input
                    readOnly
                    value={testPhotoUrl}
                    className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-600"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => set("avatar_url", testPhotoUrl)}
                      className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs hover:border-primary hover:text-primary"
                    >
                      Gebruik als avatar
                    </button>
                    <button
                      type="button"
                      onClick={() => set("gallery_urls", [...v.gallery_urls, testPhotoUrl])}
                      className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs hover:border-primary hover:text-primary"
                    >
                      Voeg toe aan galerij
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </PersonaSectionCard>
      </div>

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-black/5 bg-white/95 backdrop-blur lg:left-60">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-6 py-3">
          <div className="min-w-0 flex-1 text-xs">
            {err ? (
              <span className="font-medium text-rose-600">{err}</span>
            ) : (
              <span className="text-gray-500">
                {mode === "create" ? "Nieuwe persona — wijzigingen worden pas live na opslaan." : "Wijzigingen worden pas live na opslaan."}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {mode === "edit" && !v.is_archived ? (
              <button
                type="button"
                onClick={handleArchive}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-50 disabled:opacity-50"
              >
                <ArchiveIcon className="h-4 w-4" />
                Archiveer
              </button>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-white shadow-pill transition-colors hover:bg-primarySoft disabled:opacity-50"
            >
              {busy ? "Opslaan…" : mode === "create" ? "Persona aanmaken" : "Wijzigingen opslaan"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
