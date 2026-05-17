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
 * explicitly gates it (user sent photo + 100-credit gift first). */
const PROMPT_BLOCKLIST = [
  /child|minor|teen|underage|under.?18|loli|shota/i,
  /violence|gore|blood|rape|non.?consent/i,
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
      error: `@gradio/client niet beschikbaar: ${e instanceof Error ? e.message : String(e)}`,
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
      error: `Space connect failed: ${e instanceof Error ? e.message : String(e)}`,
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
      lastErr = e instanceof Error ? e.message : String(e);
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
): Promise<GeneratePhotoResult> {
  if (!result.ok) return result;
  const finished = await applyPhonePhotoFinish(result.bytes, result.mime);
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

  return withPhoneFinish(result);
}
