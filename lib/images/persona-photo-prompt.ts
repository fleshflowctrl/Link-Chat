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
  /** Body shape — independent from attractiveness. Drives the silhouette
   * the diffusion model commits to. */
  body_type?: "slim" | "average" | "plus";
};

/** Body-type prompt anchors — keep these on the "shape" axis only, never
 * mix in attractiveness words. The two levers compose so any combination
 * (slim+plain, plus+striking, etc.) renders correctly. */
const BODY_TYPE_ANCHORS: Record<
  NonNullable<PersonaPhotoStyle["body_type"]>,
  { positive: string; negative: string }
> = {
  slim: {
    positive:
      "slim slender body, lean figure, narrow shoulders, thin frame, slight build",
    negative: "plus size, overweight, chubby, full-figured, heavy build",
  },
  average: {
    positive:
      "average build, normal body shape, healthy proportions, neither thin nor heavy",
    negative: "skinny, very thin, plus size, overweight",
  },
  plus: {
    positive:
      "plus-size body, fuller figure, soft body, larger build, fuller arms and torso, rounder cheeks, double chin possible, curvy heavier silhouette",
    negative: "skinny, slim, very thin, athletic, fit, lean, slender",
  },
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
  // NOTE on "average": diffusion bases for Z-Image-Turbo are heavily
  // skewed toward attractive faces (LAION/AVA-style training data), so
  // simply *omitting* beauty markers does not work — every output drifts
  // back to glossy. We have to (a) explicitly anchor to "ordinary face"
  // multiple times so token-weight is high and (b) load the negative
  // prompt with every glamour-aesthetic synonym we can think of.
  average: {
    positive:
      "ordinary face, ordinary features, ordinary woman, regular everyday face you would see at the supermarket, plain regular features, mid-tier average looks, slightly imperfect asymmetric face, real natural skin texture with visible pores and small blemishes and freckles, no makeup, frizzy or simple unstyled hair, candid amateur phone photo, not posed not glamorous, looks like a normal real Dutch person",
    negative:
      "supermodel, fashion model, magazine cover, magazine shoot, vogue, instagram influencer, instagram model, beauty influencer, perfectly symmetric face, flawless skin, porcelain skin, smooth airbrushed skin, glossy, glamour shot, glamour, glam, model agency, runway, professional model, beauty pageant, beautiful woman, gorgeous, stunning, attractive face, photogenic, pretty, cute girl, hot, sexy, alluring, polished portrait, fashion photography, editorial, high-fashion, sharp jawline, defined cheekbones, big eyes, full lips, plump lips, perfect teeth, white teeth, contoured face, well-groomed, makeup look",
  },
  // "plain" goes one step further: we explicitly add anti-beauty
  // descriptors (still respectful and human, never deformed). The trick
  // is concrete, neutral physical detail rather than insults — diffusion
  // responds to "double chin, pale skin, mild acne" much better than
  // "ugly".
  plain: {
    positive:
      "plain-looking ordinary woman, below-average looks, irregular asymmetric facial features, uneven crooked smile, weak chin or no defined jawline, slightly puffy face, pale or sallow skin, visible mild acne or small scars or blemishes, large pores, frizzy unkempt hair or flat greasy hair, no makeup, tired-looking eyes, mouth slightly closed, awkward unposed candid amateur snapshot, looks like a regular non-photogenic Dutch person, not glamorous at all",
    negative:
      "supermodel, fashion model, magazine cover, vogue, instagram influencer, instagram model, model agency, runway, professional model, beauty pageant, perfectly symmetric face, flawless skin, smooth airbrushed skin, porcelain skin, glossy, glamour shot, glamour, glam, beautiful woman, gorgeous, stunning, attractive, photogenic, pretty, cute, hot, sexy, alluring, sharp jawline, defined cheekbones, high cheekbones, big eyes, full lips, plump lips, perfect teeth, white teeth, contoured face, makeup look, well-groomed, polished, professional portrait, fashion photography, editorial, high-fashion, model features",
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
 * — explicit photo_style values always take precedence. The body field
 * is left to the body-type anchor in buildPersonaPhotoPrompt so we don't
 * double-write it; here we set only appearance/style/vibe. */
function deriveDefaults(
  profile: ChatProfileRow,
  attractiveness: NonNullable<PersonaPhotoStyle["attractiveness"]>,
): Required<Pick<PersonaPhotoStyle, "appearance" | "style" | "vibe">> {
  const age = typeof profile.age === "number" ? profile.age : 25;
  const cityHint = (profile.city ?? "").toLowerCase();
  const isDutchish = !cityHint || /amsterdam|rotterdam|utrecht|nederland|netherlands|den haag|the hague/i.test(cityHint);

  if (attractiveness === "average") {
    return {
      appearance: isDutchish
        ? `${age}-jarige Nederlandse vrouw, alledaags gezicht, regelmatige trekken, natuurlijke huid met sproeten of kleine onvolmaaktheden, glimlach met asymmetrie, haar gewoon naar achter`
        : `${age}-year-old ordinary-looking woman, average everyday face, regular features`,
      style: "casual alledaagse outfit, gewoon t-shirt of trui en spijkerbroek, geen statement-stuk",
      vibe: "rustig, gewoon, een beetje verlegen, alledaags moment, geen pose",
    };
  }
  if (attractiveness === "plain") {
    return {
      appearance: isDutchish
        ? `${age}-jarige Nederlandse vrouw, onopvallend gezicht, onregelmatige trekken, lichte acne of vlekjes, fletse huid, asymmetrische glimlach, eenvoudige haar zonder styling`
        : `${age}-year-old plain-looking woman, irregular features, blemished skin`,
      style: "simpele alledaagse kleren, vaak iets te ruim of niet helemaal passend, geen mode-bewustzijn",
      vibe: "ingetogen, niet glamoureus, oprecht awkward candid moment",
    };
  }
  return {
    appearance: isDutchish
      ? `natuurlijke schoonheid, ${age}-jarige Nederlandse vrouw, rustige glimlach, lichte sproetjes, haar in een half-knot of losjes neergelaten`
      : `natural-looking ${age}-year-old woman, soft smile, light makeup, expressive eyes`,
    style: "casual everyday outfit, denim, comfortable, modern girl-next-door",
    vibe: "warm, een beetje verlegen, oprecht, candid moment",
  };
}

/** Optional per-shot framing overrides. When supplied (typically from a
 * scene template), these replace the hard-coded "casual phone selfie /
 * shot on iPhone" tail so we get full-body shots, mirror selfies,
 * candid-by-friend shots, etc. instead of the same front-camera selfie
 * every time. Each part is optional; missing parts fall back to the
 * legacy defaults. */
export type CameraStyle = {
  /** Camera distance / angle / framing instruction.
   * e.g. "full body shot from a few meters away, taken by a friend" */
  camera?: string;
  /** Visible background detail. e.g. "Vondelpark autumn leaves" */
  backdrop?: string;
  /** Lighting mood. e.g. "golden hour late afternoon, warm soft light" */
  lighting?: string;
  /** Capture-device feel. e.g. "DSLR by friend" or "phone selfie" */
  capture?: string;
};

export function buildPersonaPhotoPrompt(args: {
  profile: ChatProfileRow;
  /** Scene description — what she's showing/doing. Comes from Grok or
   * a scene template. */
  scene: string;
  /** Optional camera/lighting/backdrop overrides. When omitted we keep
   * the legacy "phone selfie at home" tail for backwards-compatibility
   * with older callers; new callers should always supply this. */
  cameraStyle?: CameraStyle;
}): { prompt: string; seed: number; negativePrompt: string } {
  const profile = args.profile;
  const customStyle = (profile as ChatProfileRow & { photo_style?: PersonaPhotoStyle }).photo_style ?? {};

  // Default to "average" / "average" so a fresh persona without an
  // explicit choice looks like a real Dutch woman instead of a magazine
  // cover. Operators who want striking/slim/plus can opt in.
  const attractiveness: NonNullable<PersonaPhotoStyle["attractiveness"]> =
    customStyle.attractiveness ?? "average";
  const bodyType: NonNullable<PersonaPhotoStyle["body_type"]> =
    customStyle.body_type ?? "average";
  const anchors = ATTRACTIVENESS_ANCHORS[attractiveness];
  const bodyAnchors = BODY_TYPE_ANCHORS[bodyType];

  const defaults = deriveDefaults(profile, attractiveness);

  const appearance = (customStyle.appearance ?? defaults.appearance).trim();
  // Operator-supplied build wins; otherwise the body-type anchor
  // provides the silhouette description so we don't double-anchor.
  const build = (customStyle.build ?? "").trim();
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
  //
  // For non-striking attractiveness we frontload the realism anchor so
  // the model commits before the scene/style descriptors lure it back
  // toward "instagram girl". Diffusion is heavily order-sensitive.
  const promptParts: string[] = [];
  if (attractiveness !== "striking") {
    promptParts.push(anchors.positive);
  }
  promptParts.push(appearance);
  if (build) promptParts.push(build);
  promptParts.push(bodyAnchors.positive);
  promptParts.push(`wearing ${style}`);
  promptParts.push(`scene: ${cleanScene}`);
  promptParts.push(vibe);
  if (attractiveness === "striking") {
    promptParts.push(anchors.positive);
  }

  // Per-shot framing — supplied by a scene template. Without these,
  // every persona photo drifts back to the same front-camera selfie
  // because the model sees no instruction to vary. Falling back to the
  // legacy defaults preserves backwards-compat for older callers.
  const cam = args.cameraStyle ?? {};
  const camera = (cam.camera ?? "casual phone selfie or candid snapshot").trim();
  const backdrop = (cam.backdrop ?? "").trim();
  const lighting = (cam.lighting ?? "soft natural lighting").trim();
  const capture = (cam.capture ?? "shot on iPhone, slight grain, intimate everyday moment").trim();
  promptParts.push(camera);
  if (backdrop) promptParts.push(`background: ${backdrop}`);
  promptParts.push(lighting);
  promptParts.push(capture);

  promptParts.push("photorealistic, high detail, no text, no watermark, no logo");

  const prompt = promptParts.filter(Boolean).join(", ");

  // Negative prompt — base + tier-specific anti-glam terms + body-type
  // counterweights. We keep "ugly" out on purpose; we want realistic,
  // not deformed.
  const baseNegative =
    "deformed, distorted, blurry, lowres, extra fingers, mutated hands, " +
    "watermark, signature, text, logo, harsh studio lighting, " +
    "ai-generated look, plastic skin, oversaturated";
  const negParts = [baseNegative];
  if (anchors.negative) negParts.push(anchors.negative);
  if (bodyAnchors.negative) negParts.push(bodyAnchors.negative);
  const negativePrompt = negParts.join(", ");

  return { prompt, seed, negativePrompt };
}
