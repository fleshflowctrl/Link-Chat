"use client";

/**
 * Auto-generate personas card.
 *
 * The flow runs in three phases per persona because Vercel caps function
 * duration well below what Z-Image-Turbo cold-starts can take, and
 * because each persona needs more than just a face to feel real:
 *
 *   Phase 1 (per persona, ~5-15s) — POST /api/admin/personas/generate-one
 *     Grok writes the profile, we upload an initials placeholder avatar,
 *     and the row is inserted. Fast and reliable.
 *
 *   Phase 2 (per persona, ~15-90s) — POST /api/admin/personas/{id}/regenerate-photo
 *     Z-Image-Turbo on Hugging Face Spaces produces the real portrait,
 *     we upload it and swap avatar_url. If the Space is cold or rate-
 *     limited the call fails, the persona keeps her initials avatar,
 *     and the operator can retry from her edit page.
 *
 *   Phase 3 (per persona, GALLERY_TARGET × ~10-30s warm)
 *     — POST /api/admin/personas/{id}/append-gallery-photo
 *     Three additional photos: full-body, candid, activity shots, all
 *     using the persona's photo_style.seed so the same face appears in
 *     different scenes. Each call appends one URL to gallery_urls;
 *     errors are non-blocking. A profile feels empty without ≥3 extra
 *     photos so the discovery feed and profile detail page expect
 *     at least this many.
 *
 * The UI shows all three phases per persona. Phase 1 errors mark the
 * persona as failed; phase 2 + 3 errors are non-blocking (the persona is
 * still created, just with fewer photos than ideal).
 */

import Image from "next/image";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SparkleIcon, CheckIcon, XIcon, CameraIcon } from "@/components/admin/icons";

type ProfileState = "pending" | "running" | "done" | "error";
type PhotoState = "pending" | "running" | "done" | "error" | "skipped";
type GalleryState = "pending" | "running" | "partial" | "done" | "error" | "skipped";

type StepResult = {
  id: string;
  display_name: string;
  age: number;
  city: string;
  occupation: string | null;
  avatar_url: string;
  photo_pending?: boolean;
};

type Step = {
  index: number;
  profileState: ProfileState;
  photoState: PhotoState;
  galleryState: GalleryState;
  /** how many gallery photos we've successfully appended so far */
  galleryDone: number;
  /** total gallery photos this batch is targeting (typically GALLERY_TARGET) */
  galleryTarget: number;
  result?: StepResult;
  realAvatarUrl?: string;
  profileError?: string;
  photoError?: string;
  galleryError?: string;
  warning?: string;
};

type Phase =
  | "idle"
  | "running-profiles"
  | "running-photos"
  | "running-gallery"
  | "done";
type Attractiveness = "striking" | "average" | "plain";
type BodyType = "slim" | "average" | "plus";

const MAX_BATCH = 10;
const MIN_BRIEF_LEN = 8;
const AGE_FLOOR = 18;
// 80 so seniors stay reachable. The diffusion + Grok pipeline both
// support it; the upper cap is purely a safeguard against typos.
const AGE_CEILING = 80;
// Discovery feed + profile detail expect ≥3 extra photos beyond the
// avatar. Generating fewer makes the gallery look like the avatar
// repeated and breaks the realism the operator is investing in.
const GALLERY_TARGET = 3;

const ATTRACTIVENESS_OPTIONS: Array<{
  id: Attractiveness;
  label: string;
  hint: string;
}> = [
  {
    id: "plain",
    label: "Gewoon",
    hint: "onopvallend, niet-perfect — voor balans in de feed",
  },
  {
    id: "average",
    label: "Normaal",
    hint: "alledaagse Nederlandse vrouw — aanbevolen default",
  },
  {
    id: "striking",
    label: "Knap",
    hint: "model-look, fotogeniek — gebruik spaarzaam",
  },
];

const BODY_OPTIONS: Array<{
  id: BodyType;
  label: string;
  hint: string;
}> = [
  { id: "slim", label: "Slank", hint: "smal frame, lean" },
  { id: "average", label: "Normaal", hint: "gemiddelde bouw — default" },
  { id: "plus", label: "Dik", hint: "voller postuur, curvy" },
];

export function BulkGenerateCard() {
  const router = useRouter();
  const [count, setCount] = useState(3);
  const [brief, setBrief] = useState("");
  const [withPhotos, setWithPhotos] = useState(true);
  const [attractiveness, setAttractiveness] = useState<Attractiveness>("average");
  const [bodyType, setBodyType] = useState<BodyType>("average");
  // Age inputs are kept as raw strings so the user can type "" → "2" → "25"
  // without the field clamping every keystroke back to AGE_FLOOR. We clamp
  // on blur (so a stray value gets fixed visually) and again at submit
  // time (server also clamps as a defensive measure).
  const [ageMinStr, setAgeMinStr] = useState("22");
  const [ageMaxStr, setAgeMaxStr] = useState("30");
  const [phase, setPhase] = useState<Phase>("idle");
  const [steps, setSteps] = useState<Step[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const abortRef = useRef(false);

  function patchStep(index: number, patch: Partial<Step>) {
    setSteps((arr) =>
      arr.map((s) => (s.index === index ? { ...s, ...patch } : s)),
    );
  }

  /** Parse the raw text in an age input. Empty / non-numeric falls back
   * to the supplied default; values outside [floor, ceiling] are clamped
   * silently. Used both in the body of startBatch (for the JSON we send
   * the server) and in the onBlur handlers (so the input shows the
   * clamped value once the user leaves the field). */
  function parseAge(raw: string, fallback: number): number {
    const n = Number(raw);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(AGE_FLOOR, Math.min(AGE_CEILING, Math.round(n)));
  }

  const ageMinNum = parseAge(ageMinStr, 22);
  const ageMaxNum = parseAge(ageMaxStr, 30);

  async function startBatch() {
    if (phase === "running-profiles" || phase === "running-photos") return;
    const trimmedBrief = brief.trim();
    if (trimmedBrief.length < MIN_BRIEF_LEN) {
      setGlobalError(
        `Briefing is te kort (min. ${MIN_BRIEF_LEN} tekens). Beschrijf het type persona in 1-3 zinnen.`,
      );
      return;
    }
    setGlobalError(null);
    abortRef.current = false;

    const total = Math.max(1, Math.min(MAX_BATCH, count));
    const initial: Step[] = Array.from({ length: total }, (_, i) => ({
      index: i,
      profileState: "pending",
      photoState: withPhotos ? "pending" : "skipped",
      galleryState: withPhotos ? "pending" : "skipped",
      galleryDone: 0,
      galleryTarget: withPhotos ? GALLERY_TARGET : 0,
    }));
    setSteps(initial);
    setPhase("running-profiles");

    // Phase 1: profiles. We loop sequentially so Grok sees the full
    // exclude list of names already used in this batch. We also keep a
    // local successList so Phase 2 doesn't have to read React state.
    const exclude: string[] = [];
    const successList: Array<{ index: number; persona: StepResult }> = [];

    for (let i = 0; i < total; i++) {
      if (abortRef.current) {
        setSteps((arr) =>
          arr.map((s) =>
            s.profileState === "pending"
              ? { ...s, profileState: "error", profileError: "Geannuleerd" }
              : s,
          ),
        );
        break;
      }
      patchStep(i, { profileState: "running" });
      try {
        const res = await fetch("/api/admin/personas/generate-one", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brief: trimmedBrief,
            index: i,
            total,
            exclude,
            attractiveness,
            body_type: bodyType,
            age_min: Math.min(ageMinNum, ageMaxNum),
            age_max: Math.max(ageMinNum, ageMaxNum),
          }),
        });
        const data: {
          ok?: boolean;
          persona?: StepResult;
          error?: string;
          warning?: string | null;
        } = await res.json().catch(() => ({}));

        if (!res.ok || !data.ok || !data.persona) {
          patchStep(i, {
            profileState: "error",
            photoState: "skipped",
            galleryState: "skipped",
            profileError: data.error ?? `HTTP ${res.status}`,
          });
          continue;
        }

        patchStep(i, {
          profileState: "done",
          result: data.persona,
          warning: data.warning ?? undefined,
        });
        successList.push({ index: i, persona: data.persona });
        exclude.push(data.persona.id);
        exclude.push(data.persona.display_name);
      } catch (e) {
        patchStep(i, {
          profileState: "error",
          photoState: "skipped",
          galleryState: "skipped",
          profileError: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // Phase 2: avatar photos. Sequential calls so the HF Space cold-
    // starts on the first call and reuses the warm worker for the rest
    // (5-15s per call instead of 60-90s). Each call has its own 60s
    // server budget — failures are non-blocking, the persona keeps her
    // initials avatar.
    if (withPhotos && successList.length > 0 && !abortRef.current) {
      setPhase("running-photos");
      // Random batch-level offset so different bulk-runs cycle through
      // the scene-template set differently. Combined with `variant`
      // below this guarantees no two personas in the same batch land
      // on the same template (assuming the avatar pool is >= batch
      // size, which it is at MAX_BATCH=10).
      const batchOffset = Math.floor(Math.random() * 1000);
      for (const { index: i, persona } of successList) {
        if (abortRef.current) {
          patchStep(i, { photoState: "skipped" });
          continue;
        }
        patchStep(i, { photoState: "running" });
        try {
          const res = await fetch(
            `/api/admin/personas/${encodeURIComponent(persona.id)}/regenerate-photo`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                slot: "avatar",
                // batchOffset + index produces a strictly-increasing
                // value per persona so the deterministic
                // pickSceneTemplate hash lands on a fresh bucket per
                // persona in the batch.
                variant: batchOffset + i,
              }),
            },
          );
          const data: {
            ok?: boolean;
            avatar_url?: string;
            error?: string;
          } = await res.json().catch(() => ({}));

          if (!res.ok || !data.ok || !data.avatar_url) {
            patchStep(i, {
              photoState: "error",
              photoError: data.error ?? `HTTP ${res.status}`,
            });
            continue;
          }
          patchStep(i, {
            photoState: "done",
            realAvatarUrl: data.avatar_url,
          });
        } catch (e) {
          patchStep(i, {
            photoState: "error",
            photoError: e instanceof Error ? e.message : String(e),
          });
        }
      }
    }

    // Phase 3: gallery photos. GALLERY_TARGET extra shots per persona
    // using the gallery-kind scene templates (full-body, candid,
    // activity). All share the persona's photo_style.seed so the same
    // face appears in different scenes — that's what makes the gallery
    // feel like a real person's photo roll instead of one selfie
    // copy-pasted six times. Each photo is its own 60s function call;
    // failures are non-blocking and we still mark `partial` if at
    // least one succeeded.
    if (withPhotos && successList.length > 0 && !abortRef.current) {
      setPhase("running-gallery");
      const galleryBatchOffset = Math.floor(Math.random() * 1000);
      for (const { index: i, persona } of successList) {
        if (abortRef.current) {
          patchStep(i, { galleryState: "skipped" });
          continue;
        }
        patchStep(i, { galleryState: "running" });
        let success = 0;
        let lastError: string | undefined;
        for (let g = 0; g < GALLERY_TARGET; g++) {
          if (abortRef.current) break;
          try {
            const res = await fetch(
              `/api/admin/personas/${encodeURIComponent(persona.id)}/append-gallery-photo`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  // Per-persona variant offset so the 3 photos in this
                  // persona's gallery roll 3 distinct templates, and
                  // different personas in the batch don't all start at
                  // template 0.
                  variant: galleryBatchOffset + i * GALLERY_TARGET + g,
                }),
              },
            );
            const data: {
              ok?: boolean;
              gallery_url?: string;
              error?: string;
            } = await res.json().catch(() => ({}));

            if (!res.ok || !data.ok || !data.gallery_url) {
              lastError = data.error ?? `HTTP ${res.status}`;
              continue;
            }
            success += 1;
            patchStep(i, { galleryDone: success });
          } catch (e) {
            lastError = e instanceof Error ? e.message : String(e);
          }
        }
        if (success >= GALLERY_TARGET) {
          patchStep(i, { galleryState: "done", galleryDone: success });
        } else if (success > 0) {
          patchStep(i, {
            galleryState: "partial",
            galleryDone: success,
            galleryError: lastError,
          });
        } else {
          patchStep(i, {
            galleryState: "error",
            galleryError: lastError ?? "Onbekende fout",
          });
        }
      }
    }

    setPhase("done");
    router.refresh();
  }

  function reset() {
    setPhase("idle");
    setSteps([]);
    setGlobalError(null);
    setBrief("");
  }

  function cancel() {
    abortRef.current = true;
  }

  const profilesDone = steps.filter((s) => s.profileState === "done").length;
  const profilesError = steps.filter((s) => s.profileState === "error").length;
  const photosDone = steps.filter((s) => s.photoState === "done").length;
  const photosError = steps.filter((s) => s.photoState === "error").length;
  const galleryDoneFull = steps.filter((s) => s.galleryState === "done").length;
  const galleryDonePartial = steps.filter((s) => s.galleryState === "partial").length;
  const galleryError = steps.filter((s) => s.galleryState === "error").length;
  const isRunning =
    phase === "running-profiles" ||
    phase === "running-photos" ||
    phase === "running-gallery";

  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-black/5 bg-gradient-to-br from-white via-lavender/30 to-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-black/5 bg-white/60 px-5 py-4 backdrop-blur">
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-primary/10 text-primary">
          <SparkleIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-semibold text-gray-900">
            Auto-genereer personas met AI
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Twee fases: eerst schrijft Grok het profiel (snel), daarna maakt
            Z-Image-Turbo de echte avatar (langzamer, kan op cold-start tot ~60s duren per foto).
          </p>
        </div>
      </div>

      {phase === "idle" ? (
        <div className="space-y-4 px-5 py-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[160px,1fr]">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-700">
                Aantal personas
              </label>
              <input
                type="number"
                min={1}
                max={MAX_BATCH}
                value={count}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n)) {
                    setCount(Math.max(1, Math.min(MAX_BATCH, Math.round(n))));
                  }
                }}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
              <p className="mt-1 text-[11px] text-gray-400">Max {MAX_BATCH} per batch.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-700">
                Briefing (type persona)
              </label>
              <textarea
                rows={3}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder='Bv: "studentes 22-26 uit de Randstad, mix soft-girl en speels, hobby-mix tussen yoga, koffie en feestjes"'
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
              <p className="mt-1 text-[11px] text-gray-400">
                Hoe specifieker, hoe meer karakter. Houd het wel onder 3-4 zinnen.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="rounded-xl bg-white p-3 ring-1 ring-black/5">
              <p className="mb-2 text-xs font-medium text-gray-700">
                Aantrekkelijkheid <span className="text-gray-400">— alle vrouwen knap = scammy</span>
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {ATTRACTIVENESS_OPTIONS.map((opt) => {
                  const active = attractiveness === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setAttractiveness(opt.id)}
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
            </div>

            <div className="rounded-xl bg-white p-3 ring-1 ring-black/5">
              <p className="mb-2 text-xs font-medium text-gray-700">
                Lichaamsbouw <span className="text-gray-400">— diversiteit is realisme</span>
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {BODY_OPTIONS.map((opt) => {
                  const active = bodyType === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setBodyType(opt.id)}
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
            </div>
          </div>

          <div className="rounded-xl bg-white p-3 ring-1 ring-black/5">
            <p className="mb-2 text-xs font-medium text-gray-700">
              Leeftijdsrange{" "}
              <span className="text-gray-400">
                — server kiest per persona random binnen [{Math.min(ageMinNum, ageMaxNum)}–
                {Math.max(ageMinNum, ageMaxNum)}]
              </span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-xs text-gray-700">
                <span className="w-12 text-gray-500">Min</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={AGE_FLOOR}
                  max={AGE_CEILING}
                  value={ageMinStr}
                  onChange={(e) => setAgeMinStr(e.target.value)}
                  onBlur={() => setAgeMinStr(String(parseAge(ageMinStr, 22)))}
                  className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-700">
                <span className="w-12 text-gray-500">Max</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={AGE_FLOOR}
                  max={AGE_CEILING}
                  value={ageMaxStr}
                  onChange={(e) => setAgeMaxStr(e.target.value)}
                  onBlur={() => setAgeMaxStr(String(parseAge(ageMaxStr, 30)))}
                  className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                />
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3 ring-1 ring-black/5">
            <label className="flex items-center gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={withPhotos}
                onChange={(e) => setWithPhotos(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span>
                <span className="font-medium">Echte foto&apos;s genereren met Z-Image-Turbo</span>
                <span className="ml-1 text-gray-500">(fase 2; ~15-90s per persona, eerste call cold-start)</span>
              </span>
            </label>
            <p className="text-[11px] text-gray-500">
              Uit = enkel initialen-avatars. Aan = echte AI-portretten via Hugging Face.
            </p>
          </div>

          {globalError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {globalError}
            </div>
          ) : null}

          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={startBatch}
              disabled={!brief.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-pill transition-transform enabled:hover:scale-[1.02] enabled:hover:bg-primarySoft disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none"
            >
              <SparkleIcon className="h-4 w-4" />
              Genereer {count} {count === 1 ? "persona" : "personas"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 px-5 py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {phase === "running-profiles"
                  ? `Fase 1 — profielen schrijven · ${profilesDone}/${steps.length}`
                  : phase === "running-photos"
                    ? `Fase 2 — avatars renderen · ${photosDone}/${profilesDone}`
                    : phase === "running-gallery"
                      ? `Fase 3 — galerij (${GALLERY_TARGET} extra foto's per persona) · ${galleryDoneFull}/${profilesDone}`
                      : `Klaar — ${profilesDone} profielen, ${photosDone} avatars, ${galleryDoneFull}/${profilesDone} volledige galerijen${
                          profilesError + photosError + galleryError > 0
                            ? ` · ${profilesError + photosError + galleryError} fouten`
                            : galleryDonePartial > 0
                              ? ` · ${galleryDonePartial} gedeeltelijk`
                              : ""
                        }`}
              </p>
              <p className="text-[11px] text-gray-500">
                Foto- en galerij-fouten zijn niet blokkerend — de persona blijft staan met initialen-avatar.
              </p>
            </div>
            {isRunning ? (
              <button
                type="button"
                onClick={cancel}
                className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
              >
                Stoppen
              </button>
            ) : (
              <button
                type="button"
                onClick={reset}
                className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:border-gray-500"
              >
                Nieuwe batch
              </button>
            )}
          </div>

          <ul className="space-y-2">
            {steps.map((s) => (
              <StepRow key={s.index} step={s} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function StepRow({ step }: { step: Step }) {
  const avatar = step.realAvatarUrl ?? step.result?.avatar_url ?? "";
  return (
    <li className="flex items-start gap-3 rounded-xl border border-black/5 bg-white px-3 py-2.5">
      {/* Avatar */}
      {avatar ? (
        <span className="relative h-10 w-10 flex-none overflow-hidden rounded-lg bg-gray-100">
          <Image src={avatar} alt={step.result?.display_name ?? ""} fill sizes="40px" className="object-cover" />
        </span>
      ) : (
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-gray-100">
          <span className="text-[11px] font-semibold text-gray-400">#{step.index + 1}</span>
        </span>
      )}

      <div className="min-w-0 flex-1">
        {step.result ? (
          <p className="truncate text-sm font-medium text-gray-900">
            {step.result.display_name}
            <span className="ml-1.5 text-xs font-normal text-gray-500">
              · {step.result.age}, {step.result.city}
              {step.result.occupation ? ` · ${step.result.occupation}` : ""}
            </span>
          </p>
        ) : step.profileState === "error" ? (
          <p className="text-sm font-medium text-rose-700">
            Persona #{step.index + 1} — profiel faalde
          </p>
        ) : step.profileState === "running" ? (
          <p className="text-sm text-gray-700">
            Persona #{step.index + 1} — profiel schrijven…
          </p>
        ) : (
          <p className="text-sm text-gray-400">Persona #{step.index + 1} — wacht</p>
        )}

        {step.result ? (
          <code className="block text-[11px] text-gray-500">{step.result.id}</code>
        ) : null}

        {/* Phase indicators */}
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
          <Pill
            label="Profiel"
            state={
              step.profileState === "done"
                ? "done"
                : step.profileState === "running"
                  ? "running"
                  : step.profileState === "error"
                    ? "error"
                    : "pending"
            }
            errorText={step.profileError}
          />
          <Pill
            label="Avatar"
            icon="camera"
            state={
              step.photoState === "done"
                ? "done"
                : step.photoState === "running"
                  ? "running"
                  : step.photoState === "error"
                    ? "error"
                    : step.photoState === "skipped"
                      ? "skipped"
                      : "pending"
            }
            errorText={step.photoError}
          />
          <Pill
            label={
              step.galleryState === "running" ||
              step.galleryState === "partial" ||
              step.galleryState === "done"
                ? `Galerij ${step.galleryDone}/${step.galleryTarget}`
                : step.galleryState === "error"
                  ? "Galerij"
                  : step.galleryState === "skipped"
                    ? "Galerij"
                    : "Galerij"
            }
            icon="camera"
            state={
              step.galleryState === "done"
                ? "done"
                : step.galleryState === "partial"
                  ? "running"
                  : step.galleryState === "running"
                    ? "running"
                    : step.galleryState === "error"
                      ? "error"
                      : step.galleryState === "skipped"
                        ? "skipped"
                        : "pending"
            }
            errorText={step.galleryError}
          />
        </div>

        {step.warning ? (
          <p className="mt-1 text-[11px] text-amber-700">⚠ {step.warning}</p>
        ) : null}
      </div>
    </li>
  );
}

function Pill({
  label,
  icon,
  state,
  errorText,
}: {
  label: string;
  icon?: "camera";
  state: "pending" | "running" | "done" | "error" | "skipped";
  errorText?: string;
}) {
  const cls = {
    pending: "bg-gray-100 text-gray-500 ring-gray-200",
    running: "bg-violet-50 text-violet-700 ring-violet-200",
    done: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    error: "bg-rose-50 text-rose-700 ring-rose-200",
    skipped: "bg-gray-50 text-gray-400 ring-gray-200",
  }[state];
  const tip = state === "error" && errorText ? errorText : undefined;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ring-1 ring-inset ${cls}`}
      title={tip}
    >
      {icon === "camera" ? <CameraIcon className="h-3 w-3" /> : null}
      {state === "running" ? (
        <span className="h-2 w-2 animate-spin rounded-full border-[1.5px] border-current border-r-transparent" />
      ) : state === "done" ? (
        <CheckIcon className="h-2.5 w-2.5" />
      ) : state === "error" ? (
        <XIcon className="h-2.5 w-2.5" />
      ) : null}
      <span>{label}</span>
      {state === "error" && errorText ? (
        <span className="ml-1 max-w-[160px] truncate text-[10px] opacity-80">
          · {errorText.slice(0, 60)}
        </span>
      ) : null}
    </span>
  );
}
