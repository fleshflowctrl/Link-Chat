/**
 * Build the image-generation prompt for a persona-photo.
 *
 * Two-part composition:
 *   1. ANCHOR — stable per persona (chat_profiles.photo_style or derived
 *      defaults). Drives visual consistency across multiple photos in
 *      the same thread: appearance, build, style, vibe, plus a fixed
 *      seed.
 *   2. SCENE — per-message, comes from Grok via the [SEND_PHOTO: ...]
 *      directive. Describes WHAT she's showing (her coffee cup, her
 *      cat, her in the gym mirror, etc.).
 *
 * The output is a single prompt string ready for the image backend.
 * We append modifiers that lean toward "casual phone photo" rather than
 * "studio shoot" because dating-app photos sent in chat should feel
 * candid, not polished.
 */

import type { ChatProfileRow } from "@/lib/chat/map-rows";

/** Optional structured photo-style stored on chat_profiles.photo_style.
 * All keys optional; missing keys fall back to derived defaults. */
export type PersonaPhotoStyle = {
  /** Free-form description of how she looks: hair, eyes, freckles, etc.
   * Aim for 1-2 sentences; specific is better than abstract. */
  appearance?: string;
  /** Body shape, height, build descriptor. Skip if not relevant. */
  build?: string;
  /** Wardrobe / aesthetic she defaults to: "soft girl, denim, oversized
   * sweaters", "athleisure", "office casual". */
  style?: string;
  /** Mood / energy she radiates in photos: "dromerig, een beetje
   * verlegen", "frisse zelfverzekerde glimlach", "speels". */
  vibe?: string;
  /** Stable seed for visual consistency. If absent, derived from peer_id. */
  seed?: number;
};

/** Cheap deterministic 32-bit hash so personas without an explicit seed
 * still get a stable one. Same algorithm as in lib/ai/bedtime.ts so
 * collisions don't matter — we just need stability. */
function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Derive a default appearance/style from the persona's profile when no
 * explicit photo_style is configured. We keep this generic-but-plausible
 * — explicit photo_style values always take precedence. */
function deriveDefaults(profile: ChatProfileRow): Required<Pick<PersonaPhotoStyle, "appearance" | "build" | "style" | "vibe">> {
  const age = typeof profile.age === "number" ? profile.age : 25;
  const cityHint = (profile.city ?? "").toLowerCase();
  const isDutchish = !cityHint || /amsterdam|rotterdam|utrecht|nederland|netherlands|den haag|the hague/i.test(cityHint);

  return {
    appearance: isDutchish
      ? "natuurlijke schoonheid, ${age}-jarige Nederlandse vrouw, rustige glimlach, lichte sproetjes, haar in een half-knot of losjes neergelaten".replace("${age}", String(age))
      : `natural-looking ${age}-year-old woman, soft smile, light makeup, expressive eyes`,
    build: "average build, gemiddelde lengte",
    style: "casual everyday outfit, denim, comfortable, modern girl-next-door",
    vibe: "warm, een beetje verlegen, oprecht, candid moment",
  };
}

export function buildPersonaPhotoPrompt(args: {
  profile: ChatProfileRow;
  /** Scene description — what she's showing/doing. Comes from Grok. */
  scene: string;
}): { prompt: string; seed: number; negativePrompt: string } {
  const profile = args.profile;
  const customStyle = (profile as ChatProfileRow & { photo_style?: PersonaPhotoStyle }).photo_style ?? {};
  const defaults = deriveDefaults(profile);

  const appearance = (customStyle.appearance ?? defaults.appearance).trim();
  const build = (customStyle.build ?? defaults.build).trim();
  const style = (customStyle.style ?? defaults.style).trim();
  const vibe = (customStyle.vibe ?? defaults.vibe).trim();

  const seed = typeof customStyle.seed === "number" ? customStyle.seed : hashSeed(profile.id);

  // Scene cleanup — strip any directive-leftover, cap length, force one sentence.
  const cleanScene = args.scene
    .replace(/^[\[\(]?send[_ ]?photo:?\s*/i, "")
    .replace(/[\]\)]\s*$/, "")
    .trim()
    .slice(0, 280);

  // Compose the full prompt. Order matters for diffusion models — the
  // most important visual anchors go first so the model commits early
  // to the persona's identity, then layers the scene on top.
  const promptParts = [
    `${appearance}`,
    build,
    `wearing ${style}`,
    `scene: ${cleanScene}`,
    vibe,
    "casual phone selfie or candid snapshot, soft natural lighting",
    "shot on iPhone, slight grain, intimate everyday moment",
    "photorealistic, high detail, no text, no watermark, no logo",
  ];
  const prompt = promptParts.filter(Boolean).join(", ");

  const negativePrompt =
    "deformed, distorted, blurry, lowres, extra fingers, mutated hands, " +
    "ugly, watermark, signature, text, logo, harsh studio lighting, " +
    "ai-generated look, plastic skin, oversaturated";

  return { prompt, seed, negativePrompt };
}
