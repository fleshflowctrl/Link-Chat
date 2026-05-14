"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Heart,
  MapPin,
  Plus,
  Trash2,
  User,
  X,
} from "lucide-react";
import {
  INTEREST_LIBRARY,
  LOOKING_FOR_OPTIONS,
  PRONOUN_OPTIONS,
  type EditProfileState,
  type PronounsValue,
} from "@/data/me-edit";
import { uploadProfileImage } from "@/lib/me/client-storage-upload";
import { setMeProfileSnapshot } from "@/lib/me-profile-store";
import { applyServerCreditsUpdate } from "@/lib/credits-store";
import {
  COMPLETENESS_FIELDS,
  type CompletenessField,
} from "@/lib/me/profile-completeness";

const BIO_MAX = 280;

const PRONOUN_LABEL_NL: Record<PronounsValue, string> = {
  "she/her": "zij/haar",
  "he/him": "hij/hem",
  "they/them": "hen/hun",
  custom: "Aangepast",
};

function gid() {
  return `g-${Math.random().toString(36).slice(2, 11)}`;
}

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

type EditProfileViewProps = {
  initialProfile: EditProfileState;
  syncToken: string;
};

export function EditProfileView({
  initialProfile,
  syncToken,
}: EditProfileViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusKey = searchParams?.get("focus");
  const mainInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const initialSerialized = useRef<string | null>(null);

  /**
   * If the /me page deep-linked us with `?focus=bio` (etc.), scroll the
   * matching section into view shortly after mount so the user lands right
   * where they need to be.
   */
  useEffect(() => {
    if (!focusKey) return;
    const id = `section-${focusKey}`;
    const t = window.setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 60);
    return () => window.clearTimeout(t);
  }, [focusKey]);

  const [state, setState] = useState<EditProfileState>(() =>
    clone(initialProfile),
  );
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lookingOpen, setLookingOpen] = useState(false);
  const [interestsOpen, setInterestsOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(true);

  useEffect(() => {
    const snap = clone(initialProfile);
    setState(snap);
    initialSerialized.current = JSON.stringify(snap);
  }, [syncToken, initialProfile]);

  const dirty = useMemo(() => {
    if (initialSerialized.current == null) return false;
    return JSON.stringify(state) !== initialSerialized.current;
  }, [state]);

  const bioLen = state.bio.length;
  const bioOver = bioLen > BIO_MAX;
  const ageInvalid =
    state.age != null && (state.age < 18 || state.age > 120);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  const save = useCallback(async () => {
    if (!dirty || bioOver || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
        credentials: "same-origin",
      });

      if (res.ok) {
        const data = (await res.json()) as {
          profile: EditProfileState;
          awarded?: { key: CompletenessField; credits: number }[];
          creditsBalance?: number;
        };
        const next = clone(data.profile);
        setMeProfileSnapshot(next);
        setState(next);
        initialSerialized.current = JSON.stringify(next);
        if (typeof data.creditsBalance === "number") {
          applyServerCreditsUpdate(data.creditsBalance);
        }
        if (data.awarded && data.awarded.length > 0) {
          const total = data.awarded.reduce((s, a) => s + a.credits, 0);
          const labels = data.awarded
            .map(
              (a) =>
                COMPLETENESS_FIELDS.find((f) => f.key === a.key)?.label ?? a.key,
            )
            .join(", ");
          showToast(`+${total} credits voor ${labels} ✨`);
        } else {
          showToast("Profiel bijgewerkt ✨");
        }
        window.setTimeout(() => router.push("/me"), 800);
        return;
      }

      if (res.status === 401 || res.status === 503) {
        setMeProfileSnapshot(clone(state));
        initialSerialized.current = JSON.stringify(state);
        showToast(
          res.status === 401
            ? "Opgeslagen op dit apparaat (log in om te synchroniseren)"
            : "Opgeslagen op dit apparaat (Supabase niet beschikbaar)",
        );
        window.setTimeout(() => router.push("/me"), 450);
        return;
      }

      const err = (await res.json().catch(() => ({}))) as { error?: string };
      showToast(err.error ?? "Profiel opslaan mislukt");
    } finally {
      setSaving(false);
    }
  }, [bioOver, dirty, router, saving, showToast, state]);

  const setMainFromFile = useCallback(
    async (file: File) => {
      const blobUrl = URL.createObjectURL(file);
      setState((s) => {
        const prev = s.mainPhotoUrl;
        if (prev.startsWith("blob:")) URL.revokeObjectURL(prev);
        return { ...s, mainPhotoUrl: blobUrl };
      });

      const r = await uploadProfileImage(file);
      if (r.ok) {
        setState((s) => {
          if (s.mainPhotoUrl !== blobUrl) return s;
          URL.revokeObjectURL(blobUrl);
          return { ...s, mainPhotoUrl: r.publicUrl };
        });
        showToast("Hoofdfoto geüpload");
        return;
      }

      showToast(
        r.error === "Supabase is niet geconfigureerd"
          ? "Alleen voorbeeld — koppel Supabase om foto’s te synchroniseren"
          : r.error,
      );
    },
    [showToast],
  );

  const addGalleryFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
      let anyUploaded = false;

      for (const f of arr) {
        const r = await uploadProfileImage(f, "gallery");
        if (r.ok) anyUploaded = true;

        setState((s) => {
          if (s.gallery.length >= 6) return s;
          if (r.ok) {
            return {
              ...s,
              gallery: [...s.gallery, { id: gid(), url: r.publicUrl }],
            };
          }
          const blobUrl = URL.createObjectURL(f);
          return { ...s, gallery: [...s.gallery, { id: gid(), url: blobUrl }] };
        });

        if (!r.ok) {
          showToast(
            r.error === "Supabase is niet geconfigureerd"
              ? "Galerij alleen voorbeeld zonder Supabase"
              : r.error,
          );
        }
      }

      if (anyUploaded) {
        showToast("Foto’s geüpload — sla profiel op om wijzigingen te bewaren");
      }
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    },
    [showToast],
  );

  function removeGalleryPhoto(id: string, url: string) {
    if (!window.confirm("Deze foto uit je profiel verwijderen?")) return;
    if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    setState((s) => ({
      ...s,
      gallery: s.gallery.filter((g) => g.id !== id),
    }));
  }

  function toggleInterest(label: string) {
    setState((s) => {
      const has = s.interests.includes(label);
      if (has) {
        return { ...s, interests: s.interests.filter((x) => x !== label) };
      }
      if (s.interests.length >= 8) return s;
      return { ...s, interests: [...s.interests, label] };
    });
  }

  const saveDisabled = !dirty || bioOver || saving || ageInvalid;

  return (
    <div className="pb-36">
      <header className="flex items-center justify-between gap-2 px-4 py-3 pt-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/80 text-white shadow-md transition active:scale-95"
          aria-label="Terug"
        >
          <ChevronLeft className="h-6 w-6" strokeWidth={2.25} />
        </button>
        <h1 className="flex-1 text-center text-lg font-bold text-ink">
          Profiel bewerken
        </h1>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saveDisabled}
          className={`min-h-[44px] shrink-0 px-2 text-[15px] font-bold ${
            saveDisabled ? "text-ink/30" : "text-primary"
          }`}
        >
          Opslaan
        </button>
      </header>

      <div id="section-photo" className="flex flex-col items-center px-5 pt-2">
        <div className="relative">
          <div className="rounded-full bg-gradient-to-br from-primary via-primarySoft to-accentPink p-[3px] shadow-card">
            <div className="relative h-40 w-40 overflow-hidden rounded-full bg-canvas ring-2 ring-white">
              {state.mainPhotoUrl ? (
                <Image
                  src={state.mainPhotoUrl}
                  alt=""
                  width={320}
                  height={320}
                  className="h-full w-full object-cover"
                  unoptimized={state.mainPhotoUrl.startsWith("blob:")}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-lavender/40 to-canvas text-ink/25">
                  <User className="h-16 w-16" strokeWidth={1.5} aria-hidden />
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => mainInputRef.current?.click()}
            className="absolute bottom-1 right-1 flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink shadow-lg ring-2 ring-canvas transition active:scale-95"
            aria-label="Foto wijzigen"
          >
            <Camera className="h-5 w-5" strokeWidth={2} />
          </button>
          <input
            ref={mainInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void setMainFromFile(f);
              e.target.value = "";
            }}
          />
        </div>
        <button
          type="button"
          onClick={() => mainInputRef.current?.click()}
          className="mt-3 text-[13px] font-semibold text-primary"
        >
          {state.mainPhotoUrl ? "Hoofdfoto wijzigen" : "Hoofdfoto toevoegen"}
        </button>
      </div>

      <section id="section-gallery" className="px-5 pt-8">
        <div className="mb-2 flex items-end justify-between gap-2">
          <h2 className="text-lg font-bold text-ink">Jouw foto’s</h2>
          <p className="text-right text-[11px] font-medium text-inkMuted">
            Maximaal 6 foto’s
          </p>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2">
          {state.gallery.map((item) => (
            <div
              key={`grid-${item.id}`}
              className="relative aspect-square overflow-hidden rounded-2xl bg-ink/10 ring-1 ring-black/[0.06] shadow-sm"
            >
              <Image
                src={item.url}
                alt=""
                fill
                sizes="120px"
                className="object-cover"
                unoptimized={item.url.startsWith("blob:")}
              />
              <button
                type="button"
                onClick={() => removeGalleryPhoto(item.id, item.url)}
                className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white"
              >
                <X className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>
          ))}
          {state.gallery.length < 6 && (
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="flex aspect-square items-center justify-center rounded-2xl border-2 border-dashed border-primary/45 bg-primary/[0.04] text-primary transition active:bg-primary/10"
              aria-label="Foto toevoegen"
            >
              <Plus className="h-7 w-7" strokeWidth={2} />
            </button>
          )}
        </div>
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => void addGalleryFiles(e.target.files)}
        />
      </section>

      <section id="section-name" className="mt-6 px-5">
        <div className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/[0.06]">
          <FieldRow label="Naam">
            <input
              className="w-full border-0 bg-transparent py-1 text-lg font-semibold text-ink outline-none ring-0 placeholder:text-ink/30"
              value={state.firstName}
              onChange={(e) =>
                setState((s) => ({ ...s, firstName: e.target.value }))
              }
            />
          </FieldRow>
          <div className="mx-4 h-px bg-black/[0.06]" />
          <FieldRow label="Leeftijd">
            <input
              id="section-age"
              type="number"
              min={18}
              max={120}
              placeholder="Leeftijd toevoegen"
              className="w-full border-0 bg-transparent py-1 text-lg font-semibold text-ink outline-none placeholder:text-ink/30"
              value={state.age ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "") {
                  setState((s) => ({ ...s, age: null }));
                  return;
                }
                const n = Number(v);
                if (!Number.isFinite(n)) return;
                setState((s) => ({ ...s, age: n }));
              }}
            />
          </FieldRow>
          <div className="mx-4 h-px bg-black/[0.06]" />
          <FieldRow label="Locatie">
            <div id="section-location" className="flex items-center gap-2 scroll-mt-24">
              <MapPin className="h-5 w-5 shrink-0 text-ink/35" strokeWidth={2} />
              <input
                className="min-w-0 flex-1 border-0 bg-transparent py-1 text-lg font-semibold text-ink outline-none"
                value={state.location}
                onChange={(e) =>
                  setState((s) => ({ ...s, location: e.target.value }))
                }
              />
            </div>
          </FieldRow>
          <div className="mx-4 h-px bg-black/[0.06]" />
          <div className="px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-inkMuted">
              Voornaamwoorden
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRONOUN_OPTIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() =>
                    setState((s) => ({
                      ...s,
                      pronouns: p,
                    }))
                  }
                  className={`rounded-full px-3.5 py-2 text-[13px] font-bold transition ${
                    state.pronouns === p
                      ? "bg-primary text-white shadow-sm"
                      : "bg-ink/[0.06] text-ink ring-1 ring-black/[0.06]"
                  }`}
                >
                  {PRONOUN_LABEL_NL[p]}
                </button>
              ))}
            </div>
            {state.pronouns === "custom" && (
              <input
                className="mt-2 w-full rounded-xl bg-ink/[0.04] px-3 py-2 text-sm font-medium text-ink outline-none ring-1 ring-black/[0.06]"
                placeholder="Jouw voornaamwoorden"
                value={state.customPronouns}
                onChange={(e) =>
                  setState((s) => ({ ...s, customPronouns: e.target.value }))
                }
              />
            )}
          </div>
        </div>
      </section>

      <section id="section-bio" className="mt-6 px-5">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-inkMuted">
          Over mij
        </label>
        <div className="relative mt-2">
          <textarea
            rows={4}
            className={`w-full resize-none rounded-xl bg-ink/[0.04] px-3 py-3 pb-8 text-[15px] leading-relaxed text-ink outline-none ring-1 ring-black/[0.06] ${
              bioOver ? "ring-2 ring-red-400/70" : ""
            }`}
            value={state.bio}
            onChange={(e) => setState((s) => ({ ...s, bio: e.target.value }))}
          />
          <span
            className={`pointer-events-none absolute bottom-2 right-3 text-[11px] font-semibold tabular-nums ${
              bioOver ? "text-red-600" : "text-inkMuted"
            }`}
          >
            {bioLen} / {BIO_MAX}
          </span>
        </div>
      </section>

      <section className="mt-6 px-5">
        <button
          type="button"
          onClick={() => setLookingOpen(true)}
          className="flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-orange-100 via-rose-100 to-pink-200 px-4 py-3.5 text-left shadow-card ring-1 ring-accentPink/20 transition active:scale-[0.99]"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accentPink to-primary text-white shadow-md">
            <Heart className="h-5 w-5" fill="currentColor" strokeWidth={0} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-accentPink">
              Op zoek naar
            </p>
            <p className="truncate text-[15px] font-bold text-ink">
              {state.lookingFor || "Kies waar je naar op zoek bent"}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-ink/30" />
        </button>
      </section>

      <section id="section-interests" className="mt-6 px-5">
        <div className="mb-1 flex items-end justify-between gap-2">
          <h2 className="text-lg font-bold text-ink">Interesses</h2>
          <p className="text-[11px] font-medium text-inkMuted">Max. 8</p>
        </div>
        <p className="mb-3 text-[12px] text-inkMuted">
          Zo vinden we betere koppelingen voor je
        </p>
        <div className="flex flex-wrap gap-2">
          {state.interests.map((label) => (
            <span
              key={label}
              className="inline-flex items-center gap-1 rounded-full bg-ink/[0.08] px-3 py-2 text-[13px] font-bold text-ink ring-1 ring-black/[0.05]"
            >
              {label}
              <button
                type="button"
                className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/10 text-ink/70 transition hover:bg-black/15"
                aria-label={`${label} verwijderen`}
                onClick={() => toggleInterest(label)}
              >
                <X className="h-3 w-3" strokeWidth={2.5} />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => setInterestsOpen(true)}
            className="inline-flex items-center rounded-full border-2 border-dashed border-primary/45 px-3 py-2 text-[13px] font-bold text-primary"
          >
            + Meer toevoegen
          </button>
        </div>
      </section>

      <section className="mt-6 px-5">
        <button
          type="button"
          onClick={() => setPrefsOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-card ring-1 ring-black/[0.06]"
        >
          <span className="text-lg font-bold text-ink">Voorkeuren</span>
          <ChevronDown
            className={`h-5 w-5 text-ink/40 transition ${prefsOpen ? "rotate-180" : ""}`}
          />
        </button>
        <AnimatePresence>
          {prefsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-2 space-y-0 overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/[0.06]">
                <ToggleRow
                  label="Toon mijn afstand"
                  checked={state.preferences.showDistance}
                  onChange={(v) =>
                    setState((s) => ({
                      ...s,
                      preferences: { ...s.preferences, showDistance: v },
                    }))
                  }
                />
                <div className="mx-4 h-px bg-black/[0.06]" />
                <ToggleRow
                  label="Toon onlinestatus"
                  checked={state.preferences.showOnlineStatus}
                  onChange={(v) =>
                    setState((s) => ({
                      ...s,
                      preferences: { ...s.preferences, showOnlineStatus: v },
                    }))
                  }
                />
                <div className="mx-4 h-px bg-black/[0.06]" />
                <ToggleRow
                  label="Sta nieuwe chatverzoeken toe"
                  checked={state.preferences.allowNewChatRequests}
                  onChange={(v) =>
                    setState((s) => ({
                      ...s,
                      preferences: { ...s.preferences, allowNewChatRequests: v },
                    }))
                  }
                />
                <div className="mx-4 h-px bg-black/[0.06]" />
                <ToggleRow
                  label="Pushmeldingen"
                  checked={state.preferences.pushNotifications}
                  onChange={(v) =>
                    setState((s) => ({
                      ...s,
                      preferences: { ...s.preferences, pushNotifications: v },
                    }))
                  }
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="mt-6 space-y-3 px-1">
          <button
            type="button"
            className="text-left text-[13px] font-medium text-inkMuted underline-offset-2 hover:underline"
            onClick={() => console.log("[edit] Hide profile temporarily")}
          >
            Profiel tijdelijk verbergen
          </button>
          <button
            type="button"
            className="flex items-center gap-2 text-left text-[13px] font-semibold text-red-600"
            onClick={() => console.log("[edit] Delete account")}
          >
            <Trash2 className="h-4 w-4" strokeWidth={2} />
            Account verwijderen
          </button>
        </div>
      </section>

      <div className="sticky bottom-0 z-30 border-t border-black/[0.06] bg-canvas/95 px-5 py-3 backdrop-blur-md">
        <button
          type="button"
          disabled={saveDisabled}
          onClick={() => void save()}
          className={`flex min-h-[52px] w-full items-center justify-center rounded-full bg-gradient-primary py-3.5 text-[15px] font-bold text-white shadow-fab transition ${
            saveDisabled ? "cursor-not-allowed opacity-50" : "active:scale-[0.99]"
          }`}
        >
          Wijzigingen opslaan
        </button>
        <p className="mt-2 text-center text-[11px] text-inkMuted">
          {state.lastUpdatedLabel}
        </p>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="fixed bottom-24 left-1/2 z-[400] -translate-x-1/2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white shadow-lg"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={lookingOpen} onClose={() => setLookingOpen(false)}>
        <h3 className="mb-3 text-lg font-bold text-ink">Op zoek naar</h3>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => {
              setState((s) => ({ ...s, lookingFor: "" }));
              setLookingOpen(false);
            }}
            className={`rounded-xl px-4 py-3 text-left text-[15px] font-semibold transition ${
              state.lookingFor === ""
                ? "bg-primary/12 text-primary ring-1 ring-primary/25"
                : "text-ink hover:bg-black/[0.03]"
            }`}
          >
            Nog niet ingesteld
          </button>
          {LOOKING_FOR_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                setState((s) => ({ ...s, lookingFor: opt }));
                setLookingOpen(false);
              }}
              className={`rounded-xl px-4 py-3 text-left text-[15px] font-semibold transition ${
                state.lookingFor === opt
                  ? "bg-primary/12 text-primary ring-1 ring-primary/25"
                  : "text-ink hover:bg-black/[0.03]"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={interestsOpen} onClose={() => setInterestsOpen(false)}>
        <h3 className="mb-3 text-lg font-bold text-ink">Interesses toevoegen</h3>
        <p className="mb-3 text-[12px] text-inkMuted">
          {state.interests.length} / 8 geselecteerd
        </p>
        <div className="max-h-[55vh] space-y-5 overflow-y-auto pr-1">
          {INTEREST_LIBRARY.map((cat) => (
            <div key={cat.category}>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-inkMuted">
                {cat.category}
              </p>
              <div className="flex flex-wrap gap-2">
                {cat.items.map((item) => {
                  const active = state.interests.includes(item);
                  const maxed =
                    !active && state.interests.length >= 8;
                  return (
                    <button
                      key={item}
                      type="button"
                      disabled={maxed}
                      onClick={() => toggleInterest(item)}
                      className={`rounded-full px-3 py-2 text-[13px] font-semibold transition ${
                        active
                          ? "bg-primary text-white shadow-sm"
                          : maxed
                            ? "cursor-not-allowed bg-ink/[0.04] text-ink/30"
                            : "bg-ink/[0.06] text-ink ring-1 ring-black/[0.06]"
                      }`}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-inkMuted">
        {label}
      </p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-3">
      <span className="text-[15px] font-semibold text-ink">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-8 w-[52px] shrink-0 rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-ink/15"
        }`}
      >
        <span
          className={`absolute left-1 top-1 h-6 w-6 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-[22px]" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function Sheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[350] flex items-end justify-center bg-black/45 p-0 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-[430px] overflow-y-auto rounded-t-3xl bg-canvas px-5 pb-10 pt-5 shadow-2xl"
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
