"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Image from "next/image";

/**
 * Admin image-lab — interactive prompt playground for the persona-photo
 * pipeline.
 *
 * The image pipeline has many knobs and the operator needs a fast way to
 * compare them side-by-side. Each generation appears in a history strip
 * with the full parameter set, so you can re-roll the same prompt with a
 * different seed, or change one knob at a time and visually compare.
 */

type LabResult = {
  id: string;
  url: string;
  prompt: string;
  negativePrompt: string;
  seed: number;
  width: number;
  height: number;
  steps: number;
  skipFinish: boolean;
  blurSigma: number;
  grainOpacity: number;
  grainStrength: number;
  backend: string;
  elapsedMs: number;
  createdAt: string;
};

type FormState = {
  prompt: string;
  negativePrompt: string;
  seed: string;
  width: number;
  height: number;
  steps: number;
  skipFinish: boolean;
  blurSigma: number;
  grainOpacity: number;
  grainStrength: number;
};

type Preset = { id: string; label: string; prompt: string };

/** Curated starter prompts. The "realistic dating selfie" family is what
 * personas usually need; keep them short — Z-Image responds better to
 * concise prompts than to long modifier stacks. */
const PROMPT_PRESETS: Preset[] = [
  {
    id: "casual-selfie",
    label: "Casual selfie · slaapkamer",
    prompt:
      "A 27-year-old Dutch woman taking a casual mirror selfie in her bedroom, warm afternoon light through the window, soft skin texture with visible pores, natural makeup, slightly tousled brown hair, wearing a plain white t-shirt, candid expression, shot on iPhone, slight noise, true-to-life color, no retouching",
  },
  {
    id: "kitchen-morning",
    label: "Ochtend · keuken, koffie",
    prompt:
      "29-year-old Dutch woman in her kitchen on a Sunday morning, holding a coffee mug with both hands, soft grey sweater, hair loose, no makeup, soft daylight from the side, natural skin imperfections, looking down at her phone, candid amateur photo aesthetic, mild lens distortion",
  },
  {
    id: "park-walk",
    label: "Park · zonnig, herfst",
    prompt:
      "26-year-old Dutch woman on a park bench in autumn, beige trench coat, hair in a low ponytail, light freckles, soft cloudy daylight, looking sideways with a small natural smile, shot on a phone, realistic everyday photo, no studio lighting",
  },
  {
    id: "bathroom-mirror",
    label: "Badkamer · mirror selfie",
    prompt:
      "31-year-old Dutch woman, casual bathroom mirror selfie, holding phone with one hand, plain black tank top, hair clipped up, bathroom tiles softly out of focus behind her, warm white LED light, realistic skin with subtle texture, true-to-life proportions, amateur phone photo",
  },
];

const DEFAULTS: FormState = {
  prompt: PROMPT_PRESETS[0]!.prompt,
  negativePrompt:
    "deformed, extra fingers, extra limbs, plastic skin, oversaturated, glossy skin, airbrushed, doll-like, low quality, blurry, watermark, text, signature",
  seed: "",
  width: 768,
  height: 1024,
  steps: 17,
  skipFinish: true,
  blurSigma: 0.45,
  grainOpacity: 0.14,
  grainStrength: 36,
};

function uniqueId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Kon bestand niet lezen"));
    reader.readAsDataURL(file);
  });
}

async function imageFileFromClipboard(
  data: DataTransfer | null,
): Promise<File | null> {
  if (!data) return null;
  const items = data.items;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item?.type.startsWith("image/")) {
      return item.getAsFile();
    }
  }
  const files = data.files;
  if (files.length > 0 && files[0]?.type.startsWith("image/")) {
    return files[0];
  }
  return null;
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </span>
      {children}
      {hint ? <span className="text-[11px] text-gray-500">{hint}</span> : null}
    </label>
  );
}

type ReferenceState = {
  baseResult: LabResult;
  variantPrompt: string;
  count: number;
};

async function generateOne(payload: Record<string, unknown>): Promise<
  | {
      ok: true;
      data: {
        url: string;
        seed: number;
        backend: string;
        elapsedMs: number;
      };
    }
  | { ok: false; error: string }
> {
  try {
    const res = await fetch("/api/admin/image-lab", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      url?: string;
      seed?: number;
      backend?: string;
      elapsedMs?: number;
      error?: string;
    };
    if (!res.ok || !data.ok || !data.url) {
      return { ok: false, error: data.error || `HTTP ${res.status}` };
    }
    return {
      ok: true,
      data: {
        url: data.url,
        seed: data.seed ?? 0,
        backend: data.backend ?? "?",
        elapsedMs: data.elapsedMs ?? 0,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function ImageLab() {
  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<LabResult[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [personaBriefAddon, setPersonaBriefAddon] = useState("");
  const [createPersonaBusy, setCreatePersonaBusy] = useState(false);
  const [createPersonaError, setCreatePersonaError] = useState<string | null>(null);
  const [createPersonaSuccess, setCreatePersonaSuccess] = useState<{
    personaId: string;
    displayName: string;
    editUrl: string;
  } | null>(null);
  const [pastedImageDataUrl, setPastedImageDataUrl] = useState<string | null>(null);
  const [reversePromptBusy, setReversePromptBusy] = useState(false);
  const [reversePromptError, setReversePromptError] = useState<string | null>(null);
  const pasteInputRef = useRef<HTMLInputElement>(null);
  const [reference, setReference] = useState<ReferenceState | null>(null);
  const [variantBusy, setVariantBusy] = useState(false);
  const [variantError, setVariantError] = useState<string | null>(null);

  const update = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const buildPayload = useCallback(
    (overrides: Partial<FormState> = {}) => {
      const merged = { ...form, ...overrides };
      const payload: Record<string, unknown> = {
        prompt: merged.prompt,
        negativePrompt: merged.negativePrompt,
        width: merged.width,
        height: merged.height,
        steps: merged.steps,
        skipFinish: merged.skipFinish,
      };
      const parsedSeed = Number.parseInt(String(merged.seed).trim(), 10);
      if (Number.isFinite(parsedSeed) && parsedSeed >= 0) {
        payload.seed = parsedSeed;
      }
      if (!merged.skipFinish) {
        payload.blurSigma = merged.blurSigma;
        payload.grainOpacity = merged.grainOpacity;
        payload.grainStrength = merged.grainStrength;
      }
      return { payload, merged };
    },
    [form],
  );

  const onSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setBusy(true);
      setError(null);
      const { payload, merged } = buildPayload();
      const res = await generateOne(payload);
      if (!res.ok) {
        setError(res.error);
        setBusy(false);
        return;
      }
      const result: LabResult = {
        id: uniqueId(),
        url: res.data.url,
        prompt: merged.prompt,
        negativePrompt: merged.negativePrompt,
        seed: res.data.seed,
        width: merged.width,
        height: merged.height,
        steps: merged.steps,
        skipFinish: merged.skipFinish,
        blurSigma: merged.blurSigma,
        grainOpacity: merged.grainOpacity,
        grainStrength: merged.grainStrength,
        backend: res.data.backend,
        elapsedMs: res.data.elapsedMs,
        createdAt: new Date().toISOString(),
      };
      setHistory((prev) => [result, ...prev].slice(0, 24));
      setBusy(false);
    },
    [buildPayload],
  );

  const onUseAsReference = useCallback((result: LabResult) => {
    setReference({ baseResult: result, variantPrompt: "", count: 2 });
    setVariantError(null);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  const onGenerateVariants = useCallback(async () => {
    if (!reference) return;
    const base = reference.baseResult;
    const extra = reference.variantPrompt.trim();
    const count = Math.max(1, Math.min(4, reference.count));

    // Combine base prompt with the operator's extra scene/pose words so
    // the identity-anchoring tokens (face, hair, build, age) stay intact
    // while only the scene/wardrobe shifts. Z-Image is text-to-image
    // only — true image-to-image / IP-Adapter isn't supported on the
    // current Space — so we lean on `seed + identity tokens` for
    // visual continuity, exactly like the persona pipeline does.
    const combinedPrompt = extra ? `${base.prompt}, ${extra}` : base.prompt;

    setVariantBusy(true);
    setVariantError(null);

    // We deliberately call sequentially. Z-Image's HF Space ZeroGPU
    // tier serializes requests under the hood; firing them in parallel
    // just makes the operator wait the same wall-time but with one
    // ambiguous "still rendering" spinner instead of N progressive
    // results.
    const errors: string[] = [];
    for (let i = 0; i < count; i++) {
      const res = await generateOne({
        prompt: combinedPrompt,
        negativePrompt: base.negativePrompt,
        // Same seed = best identity match. We jitter by +i so each
        // variant differs but stays in the same "neighborhood" of
        // the latent space.
        seed: base.seed + i,
        width: base.width,
        height: base.height,
        steps: base.steps,
        skipFinish: base.skipFinish,
        ...(base.skipFinish
          ? {}
          : {
              blurSigma: base.blurSigma,
              grainOpacity: base.grainOpacity,
              grainStrength: base.grainStrength,
            }),
      });
      if (!res.ok) {
        errors.push(`Variant ${i + 1}: ${res.error}`);
        continue;
      }
      const variant: LabResult = {
        id: uniqueId(),
        url: res.data.url,
        prompt: combinedPrompt,
        negativePrompt: base.negativePrompt,
        seed: res.data.seed,
        width: base.width,
        height: base.height,
        steps: base.steps,
        skipFinish: base.skipFinish,
        blurSigma: base.blurSigma,
        grainOpacity: base.grainOpacity,
        grainStrength: base.grainStrength,
        backend: res.data.backend,
        elapsedMs: res.data.elapsedMs,
        createdAt: new Date().toISOString(),
      };
      setHistory((prev) => [variant, ...prev].slice(0, 24));
    }

    if (errors.length > 0) {
      setVariantError(errors.join(" · "));
    }
    setVariantBusy(false);
  }, [reference]);

  const onPresetPick = useCallback((preset: Preset) => {
    setForm((prev) => ({ ...prev, prompt: preset.prompt }));
  }, []);

  const onReuse = useCallback((result: LabResult) => {
    setForm({
      prompt: result.prompt,
      negativePrompt: result.negativePrompt,
      seed: String(result.seed),
      width: result.width,
      height: result.height,
      steps: result.steps,
      skipFinish: result.skipFinish,
      blurSigma: result.blurSigma,
      grainOpacity: result.grainOpacity,
      grainStrength: result.grainStrength,
    });
  }, []);

  const onReroll = useCallback((result: LabResult) => {
    setForm({
      prompt: result.prompt,
      negativePrompt: result.negativePrompt,
      seed: "",
      width: result.width,
      height: result.height,
      steps: result.steps,
      skipFinish: result.skipFinish,
      blurSigma: result.blurSigma,
      grainOpacity: result.grainOpacity,
      grainStrength: result.grainStrength,
    });
  }, []);

  const toggleCompare = useCallback((id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1]!, id];
      return [...prev, id];
    });
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setCreatePersonaSuccess(null);
    setCreatePersonaError(null);
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((x) => x !== id);
        setAvatarId((a) => (a === id ? (next[0] ?? null) : a));
        return next;
      }
      const next = [...prev, id];
      setAvatarId((a) => a ?? id);
      return next;
    });
  }, []);

  const setAsAvatar = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setAvatarId(id);
  }, []);

  const onCreatePersona = useCallback(async () => {
    const selected = history.filter((r) => selectedIds.includes(r.id));
    if (selected.length === 0) return;

    const avatarResult =
      selected.find((r) => r.id === avatarId) ?? selected[0]!;

    setCreatePersonaBusy(true);
    setCreatePersonaError(null);
    setCreatePersonaSuccess(null);

    try {
      const res = await fetch("/api/admin/image-lab/create-persona", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          images: selected.map((r) => ({
            url: r.url,
            prompt: r.prompt,
            seed: r.seed,
          })),
          avatarUrl: avatarResult.url,
          briefAddon: personaBriefAddon.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        personaId?: string;
        displayName?: string;
        editUrl?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.personaId) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setCreatePersonaSuccess({
        personaId: data.personaId,
        displayName: data.displayName ?? data.personaId,
        editUrl: data.editUrl ?? `/admin/personas/${data.personaId}/edit`,
      });
      setSelectedIds([]);
      setAvatarId(null);
    } catch (e) {
      setCreatePersonaError(e instanceof Error ? e.message : String(e));
    } finally {
      setCreatePersonaBusy(false);
    }
  }, [history, selectedIds, avatarId, personaBriefAddon]);

  const comparisons = useMemo(
    () => compareIds.map((id) => history.find((h) => h.id === id)).filter(Boolean) as LabResult[],
    [compareIds, history],
  );

  const loadPastedFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 4 * 1024 * 1024) {
      setReversePromptError("Afbeelding te groot (max 4MB).");
      return;
    }
    setReversePromptError(null);
    const dataUrl = await fileToDataUrl(file);
    setPastedImageDataUrl(dataUrl);
  }, []);

  const onPasteZonePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const file = await imageFileFromClipboard(e.clipboardData);
      if (!file) return;
      e.preventDefault();
      await loadPastedFile(file);
    },
    [loadPastedFile],
  );

  const onPasteZoneDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) await loadPastedFile(file);
    },
    [loadPastedFile],
  );

  const onReversePrompt = useCallback(async () => {
    if (!pastedImageDataUrl) return;
    setReversePromptBusy(true);
    setReversePromptError(null);
    try {
      const res = await fetch("/api/admin/image-lab/reverse-prompt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ imageDataUrl: pastedImageDataUrl }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        prompt?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.prompt) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      update("prompt", data.prompt);
    } catch (e) {
      setReversePromptError(e instanceof Error ? e.message : String(e));
    } finally {
      setReversePromptBusy(false);
    }
  }, [pastedImageDataUrl, update]);

  return (
    <div className="space-y-6">
      {reference ? (
        <section className="rounded-2xl border border-primary/30 bg-primary/[0.04] p-5 shadow-sm">
          <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Referentie-foto · genereer varianten van dezelfde persoon
              </h2>
              <p className="mt-0.5 text-[11px] text-gray-600">
                Z-Image-Turbo ondersteunt geen echte image-to-image. We
                hergebruiken de <b>seed + originele prompt</b> en plakken jouw
                variant-prompt er achteraan — dat geeft op deze pipeline de
                stabielste "zelfde persoon"-look.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReference(null)}
              className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium hover:bg-gray-50"
            >
              Sluiten
            </button>
          </header>

          <div className="grid gap-5 sm:grid-cols-[12rem,1fr]">
            <div className="relative aspect-[3/4] overflow-hidden rounded-xl border border-black/5 bg-black/5">
              <Image
                src={reference.baseResult.url}
                alt="Referentie"
                fill
                sizes="12rem"
                className="object-cover"
                unoptimized
              />
              <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-white shadow">
                REF · seed {reference.baseResult.seed}
              </span>
            </div>

            <div className="space-y-3">
              <Field
                label="Basisprompt (vast — identiteit)"
                hint="Wordt automatisch voor je variant-prompt geplakt zodat de gezichtskenmerken behouden blijven."
              >
                <textarea
                  value={reference.baseResult.prompt}
                  readOnly
                  rows={3}
                  className="w-full resize-y rounded-xl border border-black/10 bg-gray-50 px-3 py-2 font-mono text-[12px] text-gray-600"
                />
              </Field>

              <Field
                label="Variant-prompt (alleen scène / pose / outfit)"
                hint='Bijv. "now sitting on a balcony at sunset, wearing a denim jacket" — laat de identiteit-woorden weg, die zitten al in de basisprompt.'
              >
                <textarea
                  value={reference.variantPrompt}
                  onChange={(e) =>
                    setReference({ ...reference, variantPrompt: e.target.value })
                  }
                  rows={3}
                  className="w-full resize-y rounded-xl border border-black/10 bg-white px-3 py-2 font-mono text-[13px] text-gray-900 outline-none focus:border-primary/60"
                  placeholder="Wat moet er anders zijn op de nieuwe foto's?"
                />
              </Field>

              <div className="flex flex-wrap items-end gap-3">
                <Field label="Aantal varianten">
                  <input
                    type="number"
                    min={1}
                    max={4}
                    value={reference.count}
                    onChange={(e) =>
                      setReference({
                        ...reference,
                        count: Math.max(
                          1,
                          Math.min(4, Number(e.target.value) || 1),
                        ),
                      })
                    }
                    className="w-24 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-primary/60"
                  />
                </Field>
                <button
                  type="button"
                  onClick={onGenerateVariants}
                  disabled={variantBusy}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
                >
                  {variantBusy
                    ? `Renderen ${reference.count} variant${reference.count > 1 ? "en" : ""}…`
                    : `Genereer ${reference.count} variant${reference.count > 1 ? "en" : ""}`}
                </button>
              </div>

              {variantError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
                  {variantError}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr,18rem]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-violet-200 bg-violet-50/50 p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">
              Referentie plakken → Grok schrijft prompt (1:1)
            </h2>
            <p className="mt-1 text-xs text-gray-600">
              Plak een screenshot of foto (Ctrl/Cmd+V), of sleep een bestand hierheen.
              Grok vision zet de afbeelding om in een Z-Image-prompt — daarna render je
              en vergelijk je het resultaat.
            </p>
            <div
              tabIndex={0}
              role="button"
              onPaste={onPasteZonePaste}
              onDrop={onPasteZoneDrop}
              onDragOver={(e) => e.preventDefault()}
              className="mt-3 flex min-h-[7rem] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-violet-300/80 bg-white/80 px-4 py-6 text-center outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              onClick={() => pasteInputRef.current?.click()}
            >
              <input
                ref={pasteInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void loadPastedFile(f);
                  e.target.value = "";
                }}
              />
              {pastedImageDataUrl ? (
                <div className="relative h-32 w-24 overflow-hidden rounded-lg border border-black/10 shadow-sm">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pastedImageDataUrl}
                    alt="Geplakte referentie"
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <p className="text-xs font-medium text-violet-800">
                  Klik om te uploaden of plak hier (⌘V)
                </p>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onReversePrompt}
                disabled={!pastedImageDataUrl || reversePromptBusy}
                className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {reversePromptBusy ? "Grok schrijft prompt…" : "Genereer prompt uit foto"}
              </button>
              {pastedImageDataUrl ? (
                <button
                  type="button"
                  onClick={() => {
                    setPastedImageDataUrl(null);
                    setReversePromptError(null);
                  }}
                  className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Wis referentie
                </button>
              ) : null}
            </div>
            {reversePromptError ? (
              <p className="mt-2 text-xs text-rose-700">{reversePromptError}</p>
            ) : null}
          </section>

          <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {PROMPT_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onPresetPick(p)}
                  className="rounded-full border border-black/10 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700 hover:border-primary/40 hover:bg-primary/5"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <Field
              label="Prompt"
              hint="Korter is meestal beter. Z-Image reageert sterker op concrete details (leeftijd, kleding, licht, locatie) dan op lange modifier-stacks."
            >
              <textarea
                value={form.prompt}
                onChange={(e) => update("prompt", e.target.value)}
                rows={6}
                className="min-h-32 w-full resize-y rounded-xl border border-black/10 bg-white px-3 py-2 font-mono text-[13px] leading-relaxed text-gray-900 outline-none focus:border-primary/60"
                placeholder="Describe the photo you want…"
                required
              />
            </Field>
            <div className="mt-4">
              <Field
                label="Negative prompt"
                hint="Wordt door Z-Image-Turbo Space genegeerd (guidance_scale=0). Wel gebruikt door fal/replicate-backends als die later worden aangezet."
              >
                <textarea
                  value={form.negativePrompt}
                  onChange={(e) => update("negativePrompt", e.target.value)}
                  rows={2}
                  className="w-full resize-y rounded-xl border border-black/10 bg-white px-3 py-2 font-mono text-[12px] text-gray-700 outline-none focus:border-primary/60"
                />
              </Field>
            </div>
          </div>

          <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Width" hint="512–1536">
                <input
                  type="number"
                  min={512}
                  max={1536}
                  step={64}
                  value={form.width}
                  onChange={(e) => update("width", Number(e.target.value))}
                  className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-primary/60"
                />
              </Field>
              <Field label="Height" hint="512–1536">
                <input
                  type="number"
                  min={512}
                  max={1536}
                  step={64}
                  value={form.height}
                  onChange={(e) => update("height", Number(e.target.value))}
                  className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-primary/60"
                />
              </Field>
              <Field label="Steps" hint="9 = Space default · 12–16 = scherper">
                <input
                  type="number"
                  min={4}
                  max={32}
                  step={1}
                  value={form.steps}
                  onChange={(e) => update("steps", Number(e.target.value))}
                  className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-primary/60"
                />
              </Field>
              <Field label="Seed" hint="Leeg = random elke render">
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.seed}
                  onChange={(e) => update("seed", e.target.value)}
                  placeholder="random"
                  className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-primary/60"
                />
              </Field>
            </div>
          </div>

          <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  Phone-finish pass
                </h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  Standaard zit er na elke render een uniforme blur + film-grain
                  overlay op (zie <code>lib/images/phone-photo-finish.ts</code>).
                  Zet hem hier uit om rauwe model-output te zien.
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={form.skipFinish}
                  onChange={(e) => update("skipFinish", e.target.checked)}
                  className="h-4 w-4 accent-primary"
                />
                Skip finish (rauw)
              </label>
            </div>
            <div
              className={`grid gap-4 sm:grid-cols-3 ${form.skipFinish ? "opacity-40" : ""}`}
            >
              <Field label="Blur sigma" hint="0 = scherp · 0.5 = default">
                <input
                  type="number"
                  min={0}
                  max={3}
                  step={0.05}
                  value={form.blurSigma}
                  disabled={form.skipFinish}
                  onChange={(e) => update("blurSigma", Number(e.target.value))}
                  className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-primary/60 disabled:bg-gray-50"
                />
              </Field>
              <Field label="Grain opacity" hint="0–1 · default 0.14">
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.02}
                  value={form.grainOpacity}
                  disabled={form.skipFinish}
                  onChange={(e) => update("grainOpacity", Number(e.target.value))}
                  className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-primary/60 disabled:bg-gray-50"
                />
              </Field>
              <Field label="Grain strength" hint="0–80 · default 36">
                <input
                  type="number"
                  min={0}
                  max={80}
                  step={2}
                  value={form.grainStrength}
                  disabled={form.skipFinish}
                  onChange={(e) =>
                    update("grainStrength", Number(e.target.value))
                  }
                  className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-primary/60 disabled:bg-gray-50"
                />
              </Field>
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-900">Genereer</h2>
            <p className="mt-1 text-xs text-gray-500">
              Een render duurt 8–30s na HF Space cold-start (~60s eerste keer).
            </p>
            <button
              type="submit"
              disabled={busy}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
            >
              {busy ? "Renderen…" : "Render afbeelding"}
            </button>
            {error ? (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
                {error}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setForm(DEFAULTS)}
              className="mt-3 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Reset naar defaults
            </button>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[11px] leading-relaxed text-amber-900">
            <p className="font-semibold">Tips voor stabielere output</p>
            <ul className="mt-1 space-y-1 pl-4 [list-style:disc]">
              <li>Houd prompts &lt; 60 woorden — concreet i.p.v. cumulatief.</li>
              <li>Eén leeftijd, één outfit, één locatie, één licht-bron.</li>
              <li>Steps 12–16 = duidelijk realistischer dan default 9.</li>
              <li>Vermijd "studio", "professional", "8k", "HDR" → meer plastic look.</li>
              <li>Gebruik "amateur phone photo", "true-to-life", "soft daylight".</li>
            </ul>
          </div>
        </aside>
      </form>

      {history.length > 0 ? (
        <section className="rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
          <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900">
              Historie (laatste {history.length})
            </h2>
            <p className="text-[11px] text-gray-500">
              Vink foto&apos;s aan → <em>Maak v2-persona</em>. Klik ★ voor avatar.
            </p>
          </header>

          {comparisons.length === 2 ? (
            <div className="mb-5 grid gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 sm:grid-cols-2">
              {comparisons.map((c) => (
                <ResultCard key={`cmp-${c.id}`} result={c} compact />
              ))}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {history.map((r) => (
              <ResultCard
                key={r.id}
                result={r}
                onReuse={() => onReuse(r)}
                onReroll={() => onReroll(r)}
                onToggleCompare={() => toggleCompare(r.id)}
                onUseAsReference={() => onUseAsReference(r)}
                onToggleSelect={() => toggleSelect(r.id)}
                onSetAvatar={() => setAsAvatar(r.id)}
                compareSelected={compareIds.includes(r.id)}
                selectSelected={selectedIds.includes(r.id)}
                isAvatar={avatarId === r.id}
                isCurrentReference={reference?.baseResult.id === r.id}
              />
            ))}
          </div>
        </section>
      ) : null}

      {selectedIds.length > 0 ? (
        <div className="sticky bottom-4 z-20 rounded-2xl border border-primary/30 bg-white p-4 shadow-lg ring-1 ring-black/5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900">
                {selectedIds.length} foto&apos;s geselecteerd
                <span className="ml-2 text-xs font-normal text-gray-500">
                  · klik ★ voor avatar
                </span>
              </p>
              <textarea
                value={personaBriefAddon}
                onChange={(e) => setPersonaBriefAddon(e.target.value)}
                rows={2}
                placeholder="Extra brief voor Grok (bv. dominant, latex, Rotterdam, 32 jaar, rope-fan…)"
                className="mt-2 w-full resize-y rounded-xl border border-black/10 bg-gray-50 px-3 py-2 text-xs text-gray-900 outline-none focus:border-primary/60"
              />
            </div>
            <button
              type="button"
              onClick={onCreatePersona}
              disabled={createPersonaBusy}
              className="shrink-0 rounded-xl bg-gradient-primary px-5 py-3 text-sm font-semibold text-white shadow-sm transition active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
            >
              {createPersonaBusy ? "Persona aanmaken…" : "Maak v2-persona"}
            </button>
          </div>
          {createPersonaError ? (
            <p className="mt-2 text-xs text-rose-700">{createPersonaError}</p>
          ) : null}
          {createPersonaSuccess ? (
            <p className="mt-2 text-xs text-emerald-800">
              <strong>{createPersonaSuccess.displayName}</strong> aangemaakt (
              alleen v2).{" "}
              <a
                href={createPersonaSuccess.editUrl}
                className="font-semibold underline"
              >
                Profiel bewerken →
              </a>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ResultCard({
  result,
  onReuse,
  onReroll,
  onToggleCompare,
  onUseAsReference,
  onToggleSelect,
  onSetAvatar,
  compareSelected,
  selectSelected,
  isAvatar,
  isCurrentReference,
  compact = false,
}: {
  result: LabResult;
  onReuse?: () => void;
  onReroll?: () => void;
  onToggleCompare?: () => void;
  onUseAsReference?: () => void;
  onToggleSelect?: () => void;
  onSetAvatar?: () => void;
  compareSelected?: boolean;
  selectSelected?: boolean;
  isAvatar?: boolean;
  isCurrentReference?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl border bg-gray-50 ${
        selectSelected ? "border-primary ring-2 ring-primary/30" : "border-black/5"
      }`}
    >
      <div className="relative aspect-[3/4] bg-black/5">
        <Image
          src={result.url}
          alt=""
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover"
          unoptimized
        />
        {onToggleSelect ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
            className={`absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold shadow ${
              selectSelected
                ? "border-primary bg-primary text-white"
                : "border-white/90 bg-black/40 text-white hover:bg-black/60"
            }`}
            aria-label={selectSelected ? "Deselecteren" : "Selecteren"}
          >
            {selectSelected ? "✓" : ""}
          </button>
        ) : null}
        {onSetAvatar && selectSelected ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSetAvatar();
            }}
            className={`absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full text-sm shadow ${
              isAvatar
                ? "bg-amber-400 text-amber-950 ring-2 ring-white"
                : "bg-black/50 text-white hover:bg-black/70"
            }`}
            aria-label="Instellen als avatar"
            title="Avatar"
          >
            ★
          </button>
        ) : null}
        {result.skipFinish ? (
          <span className="absolute left-2 top-2 rounded-full bg-emerald-500/95 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
            RAUW
          </span>
        ) : (
          <span className="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
            FINISH
          </span>
        )}
        {isAvatar ? (
          <span className="absolute bottom-2 left-2 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-amber-950 shadow">
            AVATAR
          </span>
        ) : null}
      </div>
      <div className="space-y-2 p-3 text-[11px] text-gray-700">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono tabular-nums text-gray-600">
          <span>seed: {result.seed}</span>
          <span>·</span>
          <span>
            {result.width}×{result.height}
          </span>
          <span>·</span>
          <span>{result.steps} steps</span>
          <span>·</span>
          <span>{(result.elapsedMs / 1000).toFixed(1)}s</span>
        </div>
        {!compact ? (
          <p className="line-clamp-3 text-[11px] text-gray-600">
            {result.prompt}
          </p>
        ) : null}
        {!compact && (onReuse || onReroll || onToggleCompare || onUseAsReference) ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {onUseAsReference ? (
              <button
                type="button"
                onClick={onUseAsReference}
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  isCurrentReference
                    ? "border border-primary bg-primary text-white"
                    : "border border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
                }`}
              >
                {isCurrentReference ? "✓ Referentie" : "Als referentie"}
              </button>
            ) : null}
            {onReuse ? (
              <button
                type="button"
                onClick={onReuse}
                className="rounded-full border border-black/10 bg-white px-2 py-0.5 text-[10px] font-medium hover:bg-gray-100"
              >
                Hergebruik
              </button>
            ) : null}
            {onReroll ? (
              <button
                type="button"
                onClick={onReroll}
                className="rounded-full border border-black/10 bg-white px-2 py-0.5 text-[10px] font-medium hover:bg-gray-100"
              >
                Re-roll
              </button>
            ) : null}
            {onToggleCompare ? (
              <button
                type="button"
                onClick={onToggleCompare}
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  compareSelected
                    ? "border border-primary bg-primary text-white"
                    : "border border-black/10 bg-white hover:bg-gray-100"
                }`}
              >
                {compareSelected ? "✓ Vergelijk" : "Vergelijk"}
              </button>
            ) : null}
            <a
              href={result.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-black/10 bg-white px-2 py-0.5 text-[10px] font-medium hover:bg-gray-100"
            >
              Open
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
}
