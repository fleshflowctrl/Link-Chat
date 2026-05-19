/**
 * Persona-photo generation.
 *
 * Backend selection (resolved per call from env):
 *   IMAGE_BACKEND=hf-space   (default) — call mrfakename/Z-Image-Turbo via
 *                            @gradio/client. Free, but rate-limited and
 *                            subject to HF Space cold-starts. Good for
 *                            development; needs a paid backend for prod.
 *   IMAGE_BACKEND=fal        — call fal.ai (FAL_KEY required). Stub for now.
 *   IMAGE_BACKEND=replicate  — call Replicate (REPLICATE_TOKEN required).
 *                              Stub for now.
 *   IMAGE_BACKEND=stub       — disabled. Always returns ok:false. Use to
 *                              suppress generation while still letting Grok
 *                              emit photo directives (they'll be silently
 *                              dropped).
 *
 * The function never throws. On any backend error it returns
 * `{ ok: false, error }` so the caller can deliver the text reply without
 * the photo and log the failure.
 *
 * Every successful render passes through `applyPhonePhotoFinish` — a
 * uniform micro-blur + grain overlay that narrows the sharp-subject /
 * soft-background gap portrait-biased models produce. See
 * lib/images/phone-photo-finish.ts. Disable with PHONE_PHOTO_FINISH=0.
 */

import { applyPhonePhotoFinish } from "@/lib/images/phone-photo-finish";

const HF_SPACE = "mrfakename/Z-Image-Turbo";

/** Default size — Z-Image-Turbo accepts 512-2048; we pick a chat-friendly
 * portrait orientation for selfies. Square for "what I'm doing" shots. */
const DEFAULTS = {
  width: 768,
  height: 1024, // portrait — selfies/casual personal photos
  steps: 9,     // 9 == 8 DiT forwards (recommended in Space)
};

/** Words/phrases that must never end up in the prompt.
 * We only hard-block child exploitation and violence/gore.
 * Nudity / adult content is allowed when the persona's system prompt
 * explicitly gates it (user sent photo + 100-credit gift first).
 *
 * CRITICAL: every pattern uses `\b` word boundaries. Earlier versions
 * relied on bare substring matching (e.g. /rape/i) which silently
 * killed perfectly innocent prompts — "hair scraped back", "Tokyo
 * skyscrapers", "draped curtain", and Dutch occupations like
 * "fysiotherapeut" / "ergotherapeut" all contain the substring
 * "rape". Similarly /teen/ matched "teenager", "fifteen", "sixteen",
 * "eighteen", "nineteen"; /minor/ matched "minority". The result was
 * "Prompt blocked by safety filter" failures on the majority of
 * persona-batch renders. Keep word boundaries on every entry. */
const PROMPT_BLOCKLIST = [
  // Underage / child-safety vocabulary
  /\b(child|children|kid|kids|infant|toddler|baby)\b/i,
  /\b(minor|minors|underage|under[\s-]?18)\b/i,
  /\b(teen|teens|teenage|teenager|teenagers|pre[-\s]?teen)\b/i,
  /\b(loli|lolita|lolicon|shota|shotacon|pedophil[a-z]*)\b/i,
  // Numeric ages 1–17 with a year/jaar marker, e.g. "15-year-old",
  // "17 jaar", "9 jr", "12 y.o.", and the Dutch "17-jarige" form
  // (so we also catch "jarig" as a stem). Trailing boundary is
  // intentionally absent so "jarige" / "year-old" suffixes both hit.
  /\b(?:[1-9]|1[0-7])[\s-]?(?:year|jaar|jarig|jr|yo|y\.?o\.?)/i,
  // Violence / non-consent
  /\b(violence|violent|gore|gory)\b/i,
  /\b(rape|raped|raping|rapist|rapists)\b/i,
  /\bnon[-\s]?consensual\b/i,
  /\bnonconsensual\b/i,
  /\bnon[-\s]?consent\b/i,
];

export type GeneratePhotoResult =
  | { ok: true; bytes: Buffer; mime: string; seed: number; backend: string }
  | { ok: false; error: string; backend: string };

export type GeneratePhotoOptions = {
  /** Fully-built prompt (handed off as-is to the model). Builders elsewhere
   * compose the persona's appearance + scene + style modifiers. */
  prompt: string;
  /** Optional negative prompt. NOTE: the current default backend
   * (Z-Image-Turbo via HF Space) does NOT accept a negative_prompt
   * parameter and runs with guidance_scale=0.0 (CFG disabled), so this
   * field is silently ignored there. It is accepted here so we can wire
   * it through to backends that DO support it (FAL/Replicate stubs are
   * placeholders). Builders should still produce a negative prompt so
   * switching backends Just Works. */
  negativePrompt?: string;
  /** Stable seed for visual consistency. Pass the persona's deterministic
   * seed to keep her looking the same across photos. */
  seed?: number;
  width?: number;
  height?: number;
  /** Override num_inference_steps. Defaults to 9 (the Space default). */
  steps?: number;
  /** Skip the phone-finish (blur + grain) post-processing pass.
   * Used by the admin image-lab where the operator wants to inspect the
   * raw model output. Production callers should leave this undefined so
   * the global PHONE_PHOTO_FINISH env still controls behavior. */
  skipFinish?: boolean;
  /** Per-call overrides for the phone-finish pass. Ignored when
   * `skipFinish` is true or the global env disables the pass entirely. */
  finishOpts?: {
    blurSigma?: number;
    grainOpacity?: number;
    grainStrength?: number;
  };
};

function resolveBackend(): "hf-space" | "fal" | "replicate" | "stub" {
  const raw = (process.env.IMAGE_BACKEND ?? "hf-space").trim().toLowerCase();
  if (raw === "fal" || raw === "replicate" || raw === "stub" || raw === "hf-space") {
    return raw;
  }
  return "hf-space";
}

function violatesBlocklist(prompt: string): boolean {
  return PROMPT_BLOCKLIST.some((re) => re.test(prompt));
}

/** Convert a "Blob | string | URL | object with url" to Buffer. The Space's
 * gradio_client returns image data in different shapes depending on
 * version — we normalise here. */
async function fetchToBuffer(input: unknown): Promise<{ bytes: Buffer; mime: string } | null> {
  // Case 1: Blob (modern @gradio/client)
  if (typeof input === "object" && input !== null && "arrayBuffer" in input && typeof (input as Blob).arrayBuffer === "function") {
    const ab = await (input as Blob).arrayBuffer();
    const mime = (input as Blob).type || "image/png";
    return { bytes: Buffer.from(ab), mime };
  }
  // Case 2: { url: "https://..." } (older Gradio)
  if (typeof input === "object" && input !== null && "url" in input && typeof (input as { url: unknown }).url === "string") {
    const url = (input as { url: string }).url;
    return await fetchUrl(url);
  }
  // Case 3: { path: "/tmp/..." } — local file path on the Space (won't work over network)
  // Case 4: bare URL string
  if (typeof input === "string" && /^https?:\/\//.test(input)) {
    return await fetchUrl(input);
  }
  return null;
}

async function fetchUrl(url: string): Promise<{ bytes: Buffer; mime: string } | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    const mime = res.headers.get("content-type") || "image/png";
    return { bytes: Buffer.from(ab), mime };
  } catch {
    return null;
  }
}

/** Z-Image-Turbo's documented JS API uses a named-parameters object, not
 * a positional array. See https://huggingface.co/spaces/mrfakename/Z-Image-Turbo
 * → "Use via API" → JavaScript tab. The `/generate_image` endpoint
 * signature is:
 *   { prompt, height, width, num_inference_steps, seed, randomize_seed }
 * and returns [image, used_seed].
 *
 * Older versions of @gradio/client accepted a positional array for any
 * endpoint, but newer Spaces (built on Gradio 5+) reject anything that
 * isn't the named-object form — which is what was happening to us:
 * connect succeeds, predict silently hangs until Vercel's timeout fires.
 *
 * We try `/generate_image` first; if the Space exposes only the
 * `/generate_image_1` variant (which appears on some versions of this
 * Space when the Hardware tier is changed) we fall back to that. */
type GradioClient = {
  predict: (
    endpoint: string,
    payload: Record<string, unknown>,
  ) => Promise<{ data: unknown[] }>;
};

/** Extract a human-readable message from anything an async function may
 * throw. The @gradio/client commonly rejects with a plain object like
 * `{ type: "status", stage: "error", message: "...", code: "...", ... }`
 * — `String(obj)` on those gives the useless "[object Object]", which is
 * exactly what showed up in the persona-batch UI. We walk a few known
 * shapes before falling back to a JSON dump so the operator can actually
 * see what HF returned (queue full, quota exceeded, ZeroGPU cold-start,
 * NSFW filter, etc.). */
function describeError(e: unknown): string {
  if (e == null) return "unknown";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message || e.name || "Error";
  if (typeof e === "object") {
    const o = e as Record<string, unknown>;
    const parts: string[] = [];
    const msg = typeof o.message === "string" ? o.message : null;
    const stage = typeof o.stage === "string" ? o.stage : null;
    const code = typeof o.code === "string" || typeof o.code === "number" ? String(o.code) : null;
    const type = typeof o.type === "string" ? o.type : null;
    if (msg) parts.push(msg);
    if (stage && stage !== "error") parts.push(`stage=${stage}`);
    if (code) parts.push(`code=${code}`);
    if (type && type !== "status") parts.push(`type=${type}`);
    if (parts.length > 0) return parts.join(" · ");
    try {
      const dump = JSON.stringify(e);
      if (dump && dump !== "{}") return dump.slice(0, 400);
    } catch {
      // fall through
    }
  }
  return String(e);
}

async function generateViaHfSpace(opts: GeneratePhotoOptions): Promise<GeneratePhotoResult> {
  const seed = opts.seed ?? Math.floor(Math.random() * 0xffffffff);

  // Lazy import — keeps the @gradio/client dep out of bundles that don't
  // need image generation, and lets us swap clients later.
  let Client: {
    connect: (id: string, opts?: Record<string, unknown>) => Promise<GradioClient>;
  };
  try {
    const mod = await import("@gradio/client");
    Client = (mod as unknown as { Client: typeof Client }).Client;
  } catch (e) {
    return {
      ok: false,
      error: `@gradio/client niet beschikbaar: ${describeError(e)}`,
      backend: "hf-space",
    };
  }

  let app: GradioClient;
  try {
    const hfToken = process.env.HF_TOKEN?.trim();
    // The newer @gradio/client uses `hf_token`, older one uses `hf_token`
    // already too — both accept the key. We pass it whenever set so the
    // operator's HF account quota is used (and ZeroGPU prio if Pro).
    app = await Client.connect(HF_SPACE, hfToken ? { hf_token: hfToken } : undefined);
  } catch (e) {
    return {
      ok: false,
      error: `Space connect failed: ${describeError(e)}`,
      backend: "hf-space",
    };
  }

  const payload: Record<string, unknown> = {
    prompt: opts.prompt,
    height: opts.height ?? DEFAULTS.height,
    width: opts.width ?? DEFAULTS.width,
    num_inference_steps: opts.steps ?? DEFAULTS.steps,
    seed,
    randomize_seed: false, // we pass an explicit seed for visual consistency
  };

  let result: { data: unknown[] } | null = null;
  let lastErr: string | null = null;

  // Try the documented endpoint name first, then the variant that some
  // copies of the Space expose. Both have identical signatures.
  for (const endpoint of ["/generate_image", "/generate_image_1"]) {
    try {
      result = await app.predict(endpoint, payload);
      break;
    } catch (e) {
      lastErr = describeError(e);
      // Also log the raw object server-side so we have the full shape
      // available in Vercel logs (the operator-facing string is
      // necessarily truncated). This is critical for debugging HF
      // failures like queue overflow, NSFW filter, or stage=error
      // messages that the human-readable summary alone hides.
      console.error("[generate-photo] predict failed", endpoint, e);
      // If predict throws because the endpoint doesn't exist we want to
      // try the next one; for transient errors (queue full, timeout)
      // there's not much value in retrying the alternate so we still
      // try it as a soft retry.
    }
  }

  if (!result) {
    return {
      ok: false,
      error: `Predict failed on /generate_image and /generate_image_1: ${lastErr ?? "unknown"}`,
      backend: "hf-space",
    };
  }

  // result.data is [image, used_seed]
  if (!Array.isArray(result.data) || result.data.length === 0) {
    return { ok: false, error: "Empty response from Space", backend: "hf-space" };
  }
  const buf = await fetchToBuffer(result.data[0]);
  if (!buf) {
    return {
      ok: false,
      error: "Could not decode image from Space response",
      backend: "hf-space",
    };
  }
  const usedSeed =
    typeof result.data[1] === "number" ? (result.data[1] as number) : seed;

  return { ok: true, bytes: buf.bytes, mime: buf.mime, seed: usedSeed, backend: "hf-space" };
}

/** Run the phone-snapshot finish pass on any successful backend result. */
async function withPhoneFinish(
  result: GeneratePhotoResult,
  opts: { skipFinish?: boolean; finishOpts?: GeneratePhotoOptions["finishOpts"] } = {},
): Promise<GeneratePhotoResult> {
  if (!result.ok) return result;
  if (opts.skipFinish) return result;
  const finished = await applyPhonePhotoFinish(result.bytes, result.mime, opts.finishOpts);
  return { ...result, bytes: finished.bytes, mime: finished.mime };
}

async function generateViaStub(_opts: GeneratePhotoOptions): Promise<GeneratePhotoResult> {
  // No actual generation — used to disable the feature without changing
  // call sites. The directive will be silently dropped upstream.
  return {
    ok: false,
    error: "image backend disabled (IMAGE_BACKEND=stub)",
    backend: "stub",
  };
}

export async function generatePersonaPhoto(
  opts: GeneratePhotoOptions,
): Promise<GeneratePhotoResult> {
  const prompt = (opts.prompt || "").trim();
  if (!prompt) {
    return { ok: false, error: "Empty prompt", backend: "none" };
  }
  if (violatesBlocklist(prompt)) {
    return { ok: false, error: "Prompt blocked by safety filter", backend: "none" };
  }

  const backend = resolveBackend();
  const sized: GeneratePhotoOptions = {
    ...opts,
    prompt,
    width: opts.width ?? DEFAULTS.width,
    height: opts.height ?? DEFAULTS.height,
    steps: opts.steps ?? DEFAULTS.steps,
  };

  let result: GeneratePhotoResult;
  switch (backend) {
    case "hf-space":
      result = await generateViaHfSpace(sized);
      break;
    case "stub":
      result = await generateViaStub(sized);
      break;
    case "fal":
    case "replicate":
      // Stubs for now — wire these up when paid backend creds land.
      result = {
        ok: false,
        error: `${backend} backend not yet implemented (placeholder)`,
        backend,
      };
      break;
    default:
      result = { ok: false, error: "Unknown backend", backend: "none" };
  }

  return withPhoneFinish(result, {
    skipFinish: opts.skipFinish,
    finishOpts: opts.finishOpts,
  });
}
