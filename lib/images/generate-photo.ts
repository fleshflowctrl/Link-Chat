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
 */

const HF_SPACE = "mrfakename/Z-Image-Turbo";

/** Default size — Z-Image-Turbo accepts 512-2048; we pick a chat-friendly
 * portrait orientation for selfies. Square for "what I'm doing" shots. */
const DEFAULTS = {
  width: 768,
  height: 1024, // portrait — selfies/casual personal photos
  steps: 9,     // 9 == 8 DiT forwards (recommended in Space)
};

/** Words/phrases that must never end up in the prompt — Z-Image-Turbo has
 * its own NSFW safety but we pre-filter at the boundary anyway. */
const PROMPT_BLOCKLIST = [
  /nude|naked|nsfw|sexual|topless|underwear|bikini|lingerie/i,
  /child|minor|teen|underage/i,
  /violence|gore|blood/i,
];

export type GeneratePhotoResult =
  | { ok: true; bytes: Buffer; mime: string; seed: number; backend: string }
  | { ok: false; error: string; backend: string };

export type GeneratePhotoOptions = {
  /** Fully-built prompt (handed off as-is to the model). Builders elsewhere
   * compose the persona's appearance + scene + style modifiers. */
  prompt: string;
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

async function generateViaHfSpace(opts: GeneratePhotoOptions): Promise<GeneratePhotoResult> {
  const seed = opts.seed ?? Math.floor(Math.random() * 0xffffffff);

  // Lazy import — keeps the @gradio/client dep out of bundles that don't
  // need image generation, and lets us swap clients later.
  let Client: { connect: (id: string, opts?: Record<string, unknown>) => Promise<{ predict: (endpoint: string | number, payload: unknown[]) => Promise<{ data: unknown[] }> }> };
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

  let app: Awaited<ReturnType<typeof Client.connect>>;
  try {
    const hfToken = process.env.HF_TOKEN?.trim();
    app = await Client.connect(HF_SPACE, hfToken ? { hf_token: hfToken } : undefined);
  } catch (e) {
    return {
      ok: false,
      error: `Space connect failed: ${e instanceof Error ? e.message : String(e)}`,
      backend: "hf-space",
    };
  }

  // The Space's generate_image signature is:
  //   (prompt, height, width, num_inference_steps, seed, randomize_seed)
  // No api_name is set so we pass by index. @gradio/client also
  // accepts the function name path "/generate_image" on most versions.
  const payload = [
    opts.prompt,
    opts.height ?? DEFAULTS.height,
    opts.width ?? DEFAULTS.width,
    opts.steps ?? DEFAULTS.steps,
    seed,
    false, // randomize_seed = false → use the seed we passed
  ];

  let result: { data: unknown[] };
  try {
    // Try named endpoint first, fall back to index 0
    try {
      result = await app.predict("/generate_image", payload);
    } catch {
      result = await app.predict(0, payload);
    }
  } catch (e) {
    return {
      ok: false,
      error: `Predict failed: ${e instanceof Error ? e.message : String(e)}`,
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

  switch (backend) {
    case "hf-space":
      return generateViaHfSpace(sized);
    case "stub":
      return generateViaStub(sized);
    case "fal":
    case "replicate":
      // Stubs for now — wire these up when paid backend creds land.
      return {
        ok: false,
        error: `${backend} backend not yet implemented (placeholder)`,
        backend,
      };
  }
}
