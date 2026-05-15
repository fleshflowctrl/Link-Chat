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
  /** Realism lever — diffusion models bias hard toward magazine-cover
   * looks unless we push back. We use this to inject explicit
   * "ordinary person" anchors and matching negatives so the discovery
   * feed has a believable mix of attractiveness levels.
   *
   *   "striking" — model-tier; the natural diffusion default
   *   "average"  — alledaagse Nederlandse vrouw (recommended default)
   *   "plain"    — onopvallend, niet-perfect, maar oprecht authentiek */
  attractiveness?: "striking" | "average" | "plain";
};

/** Per-tier prompt anchors. Diffusion models train mostly on attractive,
 * polished imagery, so for "average" and "plain" we don't just *omit*
 * beauty markers — we *explicitly add* the opposite + reinforce with
 * the negative prompt. This is the only way to get a believable spread. */
const ATTRACTIVENESS_ANCHORS: Record<
  NonNullable<PersonaPhotoStyle["attractiveness"]>,
  { positive: string; negative: string }
> = {
  striking: {
    positive:
      "naturally beautiful, photogenic, expressive eyes, healthy radiant skin, well-proportioned features",
    negative: "",
  },
  average: {
    positive:
      "ordinary average-looking woman, regular everyday face, mid-tier looks, slightly imperfect features, natural skin texture with pores and small blemishes, no makeup or minimal makeup, candid not posed, average build, looks like a real person you'd see at the supermarket",
    negative:
      "supermodel, magazine cover, fashion model, instagram influencer, perfectly symmetric, flawless porcelain skin, glossy, glamour shot, model agency, runway, beautiful, gorgeous, stunning, attractive",
  },
  plain: {
    positive:
      "plain-looking woman, below-average attractiveness, irregular features, asymmetric face, uneven skin tone, visible blemishes or freckles or acne scars, no makeup, frizzy or flat hair, awkward natural smile, ordinary build, looks like a regular Dutch woman, not glamorous, not photogenic, candid amateur snapshot",
    negative:
      "supermodel, magazine cover, fashion model, instagram influencer, perfectly symmetric, flawless skin, glamour shot, model, beautiful, gorgeous, stunning, attractive, photogenic, professional photo, polished, glossy, smooth skin, perfect teeth, perfect hair",
  },
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
function deriveDefaults(
  profile: ChatProfileRow,
  attractiveness: NonNullable<PersonaPhotoStyle["attractiveness"]>,
): Required<Pick<PersonaPhotoStyle, "appearance" | "build" | "style" | "vibe">> {
  const age = typeof profile.age === "number" ? profile.age : 25;
  const cityHint = (profile.city ?? "").toLowerCase();
  const isDutchish = !cityHint || /amsterdam|rotterdam|utrecht|nederland|netherlands|den haag|the hague/i.test(cityHint);

  if (attractiveness === "average") {
    return {
      appearance: isDutchish
        ? `${age}-jarige Nederlandse vrouw, alledaags gezicht, regelmatige trekken, natuurlijke huid met sproeten of kleine onvolmaaktheden, glimlach met asymmetrie, haar gewoon naar achter`
        : `${age}-year-old ordinary-looking woman, average everyday face, regular features`,
      build: "gemiddelde bouw, normale lengte, niet sportief en niet curvy",
      style: "casual alledaagse outfit, gewoon t-shirt of trui en spijkerbroek, geen statement-stuk",
      vibe: "rustig, gewoon, een beetje verlegen, alledaags moment, geen pose",
    };
  }
  if (attractiveness === "plain") {
    return {
      appearance: isDutchish
        ? `${age}-jarige Nederlandse vrouw, onopvallend gezicht, onregelmatige trekken, lichte acne of vlekjes, fletse huid, asymmetrische glimlach, eenvoudige haar zonder styling`
        : `${age}-year-old plain-looking woman, irregular features, blemished skin`,
      build: "gewone bouw, niet sportief, niet bijzonder",
      style: "simpele alledaagse kleren, vaak iets te ruim of niet helemaal passend, geen mode-bewustzijn",
      vibe: "ingetogen, niet glamoureus, oprecht awkward candid moment",
    };
  }
  return {
    appearance: isDutchish
      ? `natuurlijke schoonheid, ${age}-jarige Nederlandse vrouw, rustige glimlach, lichte sproetjes, haar in een half-knot of losjes neergelaten`
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

  // Default to "average" so a fresh persona without an explicit choice
  // looks like a real Dutch woman instead of a magazine cover. Operators
  // who want striking can opt in.
  const attractiveness: NonNullable<PersonaPhotoStyle["attractiveness"]> =
    customStyle.attractiveness ?? "average";
  const anchors = ATTRACTIVENESS_ANCHORS[attractiveness];

  const defaults = deriveDefaults(profile, attractiveness);

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
    anchors.positive,
    "casual phone selfie or candid snapshot, soft natural lighting",
    "shot on iPhone, slight grain, intimate everyday moment",
    "photorealistic, high detail, no text, no watermark, no logo",
  ];
  const prompt = promptParts.filter(Boolean).join(", ");

  // Negative prompt — base + tier-specific anti-glam terms. We keep
  // "ugly" out of the average/plain negative on purpose; we want
  // realistic, not deformed. The tier-specific block instead pushes
  // away from supermodel/glamour aesthetics.
  const baseNegative =
    "deformed, distorted, blurry, lowres, extra fingers, mutated hands, " +
    "watermark, signature, text, logo, harsh studio lighting, " +
    "ai-generated look, plastic skin, oversaturated";
  const negativePrompt = anchors.negative
    ? `${baseNegative}, ${anchors.negative}`
    : baseNegative;

  return { prompt, seed, negativePrompt };
}
