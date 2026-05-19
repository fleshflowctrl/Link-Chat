"use client";

import { useCallback, useMemo, useState } from "react";
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
  steps: 12,
  skipFinish: true,
  blurSigma: 0.45,
  grainOpacity: 0.14,
  grainStrength: 36,
};

function uniqueId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
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

export function ImageLab() {
  const [form, setForm] = useState<FormState>(DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<LabResult[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  const update = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const onSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      setBusy(true);
      setError(null);
      try {
        const payload: Record<string, unknown> = {
          prompt: form.prompt,
          negativePrompt: form.negativePrompt,
          width: form.width,
          height: form.height,
          steps: form.steps,
          skipFinish: form.skipFinish,
        };
        const parsedSeed = Number.parseInt(form.seed.trim(), 10);
        if (Number.isFinite(parsedSeed) && parsedSeed >= 0) {
          payload.seed = parsedSeed;
        }
        if (!form.skipFinish) {
          payload.blurSigma = form.blurSigma;
          payload.grainOpacity = form.grainOpacity;
          payload.grainStrength = form.grainStrength;
        }

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
          throw new Error(data.error || `HTTP ${res.status}`);
        }

        const result: LabResult = {
          id: uniqueId(),
          url: data.url,
          prompt: form.prompt,
          negativePrompt: form.negativePrompt,
          seed: data.seed ?? 0,
          width: form.width,
          height: form.height,
          steps: form.steps,
          skipFinish: form.skipFinish,
          blurSigma: form.blurSigma,
          grainOpacity: form.grainOpacity,
          grainStrength: form.grainStrength,
          backend: data.backend ?? "?",
          elapsedMs: data.elapsedMs ?? 0,
          createdAt: new Date().toISOString(),
        };
        setHistory((prev) => [result, ...prev].slice(0, 16));
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [form],
  );

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

  const comparisons = useMemo(
    () => compareIds.map((id) => history.find((h) => h.id === id)).filter(Boolean) as LabResult[],
    [compareIds, history],
  );

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1fr,18rem]">
        <div className="space-y-4">
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
              Klik <em>Vergelijk</em> op twee renders om ze naast elkaar te zien.
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
                compareSelected={compareIds.includes(r.id)}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ResultCard({
  result,
  onReuse,
  onReroll,
  onToggleCompare,
  compareSelected,
  compact = false,
}: {
  result: LabResult;
  onReuse?: () => void;
  onReroll?: () => void;
  onToggleCompare?: () => void;
  compareSelected?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-black/5 bg-gray-50">
      <div className="relative aspect-[3/4] bg-black/5">
        <Image
          src={result.url}
          alt=""
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover"
          unoptimized
        />
        {result.skipFinish ? (
          <span className="absolute left-2 top-2 rounded-full bg-emerald-500/95 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
            RAUW
          </span>
        ) : (
          <span className="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
            FINISH
          </span>
        )}
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
        {!compact && (onReuse || onReroll || onToggleCompare) ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
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
