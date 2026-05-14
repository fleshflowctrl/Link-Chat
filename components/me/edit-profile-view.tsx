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
  /** Always points to the latest `state` so async callbacks can read it
   *  without forcing themselves to be re-created on every keystroke. */
  const stateRef = useRef<EditProfileState>(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** Set to true while a save is in flight so the debounce effect can
   *  stay quiet and let it finish before scheduling another. */
  const savingRef = useRef(false);
  /** Bumped after every successful save so memoized values that read from
   *  `initialSerialized` (a ref) recompute. */
  const [savedTick, setSavedTick] = useState(0);
  /** Gallery item ids whose upload is still in flight — used to render
   *  a spinner on the corresponding tile. */
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(
    () => new Set(),
  );
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
    // savedTick is intentional — bumping it after a save forces this memo
    // to re-read `initialSerialized.current` which was just updated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, savedTick]);

  const bioLen = state.bio.length;
  const bioOver = bioLen > BIO_MAX;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  /**
   * Persist the current edit state to the server. Captures `stateRef` at
   * call time so we never overwrite what the user is typing with a server
   * response (the server may normalize values, e.g. clamp age).
   *
   * Stable identity (no `state` dependency) so the debounce effect doesn't
   * re-fire on every keystroke.
   */
  const persist = useCallback(async () => {
    if (savingRef.current) return;
    const snap = stateRef.current;
    // Never send obviously invalid intermediate values (e.g. half-typed age).
    if (snap.bio.length > BIO_MAX) return;
    if (snap.age != null && (snap.age < 18 || snap.age > 120)) return;

    // Nothing to save if it matches the last successful payload.
    const serialized = JSON.stringify(snap);
    if (serialized === initialSerialized.current) return;

    savingRef.current = true;
    setSaving(true);
    try {
      const res = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: serialized,
        credentials: "same-origin",
      });

      if (res.ok) {
        const data = (await res.json()) as {
          profile: EditProfileState;
          awarded?: { key: CompletenessField; credits: number }[];
          creditsBalance?: number;
        };
        // IMPORTANT: do NOT setState(data.profile) here — the user may have
        // typed more characters while this request was in flight. We only
        // mark "what we just sent" as the new baseline so `dirty` flips
        // back to false IF nothing has changed since.
        initialSerialized.current = serialized;
        setSavedTick((n) => n + 1);
        setMeProfileSnapshot(clone(snap));
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
        }
        return;
      }

      if (res.status === 401 || res.status === 503) {
        setMeProfileSnapshot(clone(snap));
        initialSerialized.current = serialized;
        setSavedTick((n) => n + 1);
        return;
      }

      const err = (await res.json().catch(() => ({}))) as { error?: string };
      if (err.error) showToast(err.error);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [showToast]);

  /**
   * Debounced auto-save. Resets the timer on every state change; only
   * fires once the user has paused for ~900 ms. Re-arms after a save
   * completes (via `saving` dep) so changes the user typed mid-flight
   * don't get stranded.
   */
  useEffect(() => {
    if (saving) return;
    if (!dirty || bioOver) return;
    if (state.age != null && (state.age < 18 || state.age > 120)) return;
    const t = window.setTimeout(() => {
      void persist();
    }, 900);
    return () => window.clearTimeout(t);
  }, [bioOver, dirty, persist, saving, state]);

  /**
   * Failsafe flush so we never lose changes if the user navigates away
   * before the debounce timer fires.
   */
  useEffect(() => {
    const flush = () => {
      if (savingRef.current) return;
      void persist();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [persist]);

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
      if (!arr.length) {
        showToast("Kies een afbeeldingsbestand");
        return;
      }

      // Optimistic add: insert each photo immediately as a blob preview so
      // the user sees instant feedback. Then upload in the background and
      // swap the blob URL for the public URL on success.
      const pending = arr
        .slice(0, 6)
        .map((file) => ({ file, id: gid(), blobUrl: URL.createObjectURL(file) }));

      setState((s) => {
        const room = Math.max(0, 6 - s.gallery.length);
        if (room === 0) return s;
        const toAdd = pending.slice(0, room).map((p) => ({
          id: p.id,
          url: p.blobUrl,
        }));
        return { ...s, gallery: [...s.gallery, ...toAdd] };
      });

      // Mark these blob ids as uploading so the UI can render a spinner.
      setUploadingIds((prev) => {
        const next = new Set(prev);
        for (const p of pending) next.add(p.id);
        return next;
      });

      // Upload in parallel — each photo independently swaps its blob URL
      // for the public URL once the upload finishes (or stays as blob if
      // Supabase rejected it, so the user still sees a preview).
      await Promise.all(
        pending.map(async (p) => {
          const r = await uploadProfileImage(p.file, "gallery");
          if (r.ok) {
            setState((s) => ({
              ...s,
              gallery: s.gallery.map((g) =>
                g.id === p.id ? { ...g, url: r.publicUrl } : g,
              ),
            }));
            URL.revokeObjectURL(p.blobUrl);
          } else {
            showToast(
              r.error === "Supabase is niet geconfigureerd"
                ? "Galerij alleen voorbeeld zonder Supabase"
                : r.error,
            );
          }
          setUploadingIds((prev) => {
            const next = new Set(prev);
            next.delete(p.id);
            return next;
          });
        }),
      );

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

  return (
    <div className="pb-10">
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
        {/* Spacer to balance the back button so the title stays centered. */}
        <div className="h-11 w-11 shrink-0" aria-hidden />
      </header>

      <div id="section-photo" className="flex flex-col items-center px-5 pt-1">
        <div className="relative">
          <div className="rounded-full bg-gradient-to-br from-primary via-primarySoft to-accentPink p-[3px] shadow-card">
            <div className="relative h-32 w-32 overflow-hidden rounded-full bg-canvas ring-2 ring-white">
              {state.mainPhotoUrl ? (
                <Image
                  src={state.mainPhotoUrl}
                  alt=""
                  width={256}
                  height={256}
                  className="h-full w-full object-cover"
                  unoptimized={state.mainPhotoUrl.startsWith("blob:")}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-lavender/40 to-canvas text-ink/25">
                  <User className="h-12 w-12" strokeWidth={1.5} aria-hidden />
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => mainInputRef.current?.click()}
            className="absolute bottom-0.5 right-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-white text-ink shadow-lg ring-2 ring-canvas transition active:scale-95"
            aria-label="Foto wijzigen"
          >
            <Camera className="h-[18px] w-[18px]" strokeWidth={2} />
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
          className="mt-2.5 text-[13px] font-semibold text-primary"
        >
          {state.mainPhotoUrl ? "Hoofdfoto wijzigen" : "Hoofdfoto toevoegen"}
        </button>
      </div>

      <section id="section-gallery" className="px-5 pt-6">
        <div className="mb-2 flex items-end justify-between gap-2">
          <h2 className="text-[15px] font-bold text-ink">Jouw foto’s</h2>
          <p className="text-right text-[11px] font-medium text-inkMuted">
            Maximaal 6 foto’s
          </p>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2">
          {state.gallery.map((item) => {
            const uploading = uploadingIds.has(item.id);
            return (
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
                {uploading && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35">
                    <span className="h-6 w-6 animate-spin rounded-full border-[3px] border-white/35 border-t-white" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => removeGalleryPhoto(item.id, item.url)}
                  className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white"
                >
                  <X className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </div>
            );
          })}
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
          onClick={(e) => {
            // Reset value so re-selecting the same file still fires onChange.
            (e.currentTarget as HTMLInputElement).value = "";
          }}
          onChange={(e) => void addGalleryFiles(e.target.files)}
        />
      </section>

      <section id="section-name" className="mt-5 px-5">
        <div className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-black/[0.06]">
          <FieldRow label="Naam">
            <input
              className="w-full border-0 bg-transparent py-0.5 text-[16px] font-semibold text-ink outline-none ring-0 placeholder:text-ink/30"
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
              className="w-full border-0 bg-transparent py-0.5 text-[16px] font-semibold text-ink outline-none placeholder:text-ink/30"
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
              <MapPin className="h-[18px] w-[18px] shrink-0 text-ink/35" strokeWidth={2} />
              <input
                className="min-w-0 flex-1 border-0 bg-transparent py-0.5 text-[16px] font-semibold text-ink outline-none"
                value={state.location}
                onChange={(e) =>
                  setState((s) => ({ ...s, location: e.target.value }))
                }
              />
            </div>
          </FieldRow>
          <div className="mx-4 h-px bg-black/[0.06]" />
          <div className="px-4 py-2.5">
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
                  className={`rounded-full px-3 py-1.5 text-[13px] font-bold transition ${
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

      <section id="section-bio" className="mt-5 px-5">
        <label className="text-[11px] font-semibold uppercase tracking-wide text-inkMuted">
          Over mij
        </label>
        <div className="relative mt-2">
          <textarea
            rows={3}
            className={`w-full resize-none rounded-xl bg-ink/[0.04] px-3 py-2.5 pb-7 text-[14px] leading-relaxed text-ink outline-none ring-1 ring-black/[0.06] ${
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

      <section className="mt-5 px-5">
        <button
          type="button"
          onClick={() => setLookingOpen(true)}
          className="flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-orange-100 via-rose-100 to-pink-200 px-4 py-3 text-left shadow-card ring-1 ring-accentPink/20 transition active:scale-[0.99]"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accentPink to-primary text-white shadow-md">
            <Heart className="h-[18px] w-[18px]" fill="currentColor" strokeWidth={0} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-accentPink">
              Op zoek naar
            </p>
            <p className="truncate text-[14px] font-bold text-ink">
              {state.lookingFor || "Kies waar je naar op zoek bent"}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-ink/30" />
        </button>
      </section>

      <section id="section-interests" className="mt-5 px-5">
        <div className="mb-1 flex items-end justify-between gap-2">
          <h2 className="text-[15px] font-bold text-ink">Interesses</h2>
          <p className="text-[11px] font-medium text-inkMuted">Max. 8</p>
        </div>
        <p className="mb-2 text-[12px] text-inkMuted">
          Zo vinden we betere koppelingen voor je
        </p>
        <div className="flex flex-wrap gap-2">
          {state.interests.map((label) => (
            <span
              key={label}
              className="inline-flex items-center gap-1 rounded-full bg-ink/[0.08] px-2.5 py-1.5 text-[13px] font-bold text-ink ring-1 ring-black/[0.05]"
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
            className="inline-flex items-center rounded-full border-2 border-dashed border-primary/45 px-2.5 py-1.5 text-[13px] font-bold text-primary"
          >
            + Meer toevoegen
          </button>
        </div>
      </section>

      <section className="mt-5 px-5">
        <button
          type="button"
          onClick={() => setPrefsOpen((o) => !o)}
          className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-2.5 shadow-card ring-1 ring-black/[0.06]"
        >
          <span className="text-[15px] font-bold text-ink">Voorkeuren</span>
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
    <div className="px-4 py-2.5">
      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-inkMuted">
        {label}
      </p>
      <div className="mt-0.5">{children}</div>
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
    <div className="flex min-h-[44px] items-center justify-between gap-3 px-4 py-2">
      <span className="text-[14px] font-semibold text-ink">{label}</span>
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
