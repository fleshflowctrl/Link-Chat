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

/** Age-tier prompt anchors. Diffusion bases (Z-Image-Turbo included)
 * are heavily skewed toward 20-30 year old subjects — most training
 * data is "young attractive woman", so without explicit anchors a
 * "55-jarige Nederlandse vrouw" still renders as someone in their late
 * 20s. We push back with concrete physical tokens, but calibration
 * matters in BOTH directions:
 *
 *   - Too weak ("55-year-old woman") → model ignores it, output 25-30.
 *   - Too strong ("post-menopausal, deep wrinkles, jowls, age spots") →
 *     model overshoots, output looks 80+.
 *
 * 55-65 is "middle-aged but NOT elderly". They have fine lines, maybe
 * some grey at the temples, settled features — but not jowls, not
 * sagging skin, not a grandmother. The `late_middle` tier is calibrated
 * for that. Real "elderly" anchors only kick in at 65+. */
type AgeTier =
  | "young"
  | "thirties"
  | "forties"
  | "late_middle"
  | "senior";

function ageToTier(age: number): AgeTier {
  if (age < 30) return "young";
  if (age < 40) return "thirties";
  if (age < 50) return "forties";
  if (age < 65) return "late_middle";
  return "senior";
}

const AGE_ANCHORS: Record<AgeTier, { positive: string; negative: string }> = {
  young: {
    positive: "",
    negative: "",
  },
  thirties: {
    positive:
      "woman in her thirties, mature adult face, subtle fine lines around eyes when smiling, settled adult features",
    negative:
      "teenager, twenties, very young, youthful babyface, college-aged",
  },
  forties: {
    positive:
      "woman in her forties, mature adult face, visible fine lines around eyes and mouth, possibly a few grey hairs at the temples, settled adult features",
    negative:
      "young woman, twenties, smooth youthful skin, teenage, college-aged, twentysomething",
  },
  // 50-64 — middle-aged. NOT elderly, NOT a grandmother. Fine lines,
  // possibly dyed hair or some grey at temples, but no jowls, no
  // sagging skin, no age spots. Operator hit "55-65 looks like 80-90"
  // when this tier was too aggressive — calibration is deliberately
  // soft here.
  late_middle: {
    positive:
      "woman in her fifties or early sixties, middle-aged face, visible fine lines around eyes and mouth, mature skin texture, hair may have some grey at the temples or be dyed, settled mature adult features, well-kept and presentable, NOT elderly, NOT a grandmother",
    negative:
      "young woman, twenties, thirties, smooth youthful skin, teenage, college-aged, taut babyface, instagram filter, elderly, very old, eighty, ninety, deep deep wrinkles, sagging jowls, frail, grandmother, senior citizen, elderly woman",
  },
  // 65+ — actual senior. Deeper wrinkles, fully grey or white hair,
  // softer jawline, age spots become visible. This is where the
  // "elderly woman" tokens belong.
  senior: {
    positive:
      "older woman in her late sixties or seventies, mature elderly face with deeper wrinkles around eyes mouth and forehead, softened jawline, grey or white hair, age spots possible on hands, mature older skin texture",
    negative:
      "young woman, middle-aged, twenties, thirties, forties, smooth skin, youthful, fresh face, dark hair without grey, instagram filter, taut skin, plump cheeks",
  },
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
/** Concrete age cues by tier. Used both in deriveDefaults (when the
 * operator hasn't supplied a custom appearance) and as fallback hints
 * when the Grok-generated appearance might still be 25-coded.
 *
 * Calibrated alongside AGE_ANCHORS — these are subtle reinforcements,
 * not the primary signal. Too aggressive here causes overshoot. */
function ageHairAndSkinHint(age: number): string {
  if (age < 30) return "";
  if (age < 40)
    return "lichte rimpeltjes rond de ogen wanneer ze lacht, volwassen gezicht";
  if (age < 50)
    return "fijne rimpels rond ogen en mond, volwassen huidstructuur, mogelijk een paar grijze haren bij de slapen";
  if (age < 65)
    // 50-64 — soft cue. Fine lines, possibly some grey, but explicitly
    // NOT elderly markers like jowls, age spots or deep wrinkles. The
    // operator complained that 55-65 came out looking 80+ — this is
    // where calibration matters most.
    return "fijne rimpels rond ogen en mond, volwassen huidstructuur, haar mogelijk geverfd of met grijze plukken bij de slapen, verzorgd middelbaar uiterlijk";
  return "duidelijke rimpels rond ogen en mond, grijs of wit haar, oudere huidstructuur";
}

function deriveDefaults(
  profile: ChatProfileRow,
  attractiveness: NonNullable<PersonaPhotoStyle["attractiveness"]>,
): Required<Pick<PersonaPhotoStyle, "appearance" | "style" | "vibe">> {
  const age = typeof profile.age === "number" ? profile.age : 25;
  const cityHint = (profile.city ?? "").toLowerCase();
  const isDutchish = !cityHint || /amsterdam|rotterdam|utrecht|nederland|netherlands|den haag|the hague/i.test(cityHint);

  // Age-aware style/vibe defaults — the appearance string itself stays
  // age-agnostic here because the age cue is added as a separate
  // prompt-part in buildPersonaPhotoPrompt (so even Grok's custom
  // appearance gets a concrete grey-hair-or-not token alongside it).
  const styleByAge = (young: string, mature: string): string =>
    age >= 50 ? mature : young;

  if (attractiveness === "average") {
    return {
      appearance: isDutchish
        ? `${age}-jarige Nederlandse vrouw, alledaags gezicht, regelmatige trekken, natuurlijke huid met sproeten of kleine onvolmaaktheden, glimlach met asymmetrie, haar gewoon naar achter`
        : `${age}-year-old ordinary-looking woman, average everyday face, regular features`,
      style: styleByAge(
        "casual alledaagse outfit, gewoon t-shirt of trui en spijkerbroek, geen statement-stuk",
        "comfortabele alledaagse kleren passend bij haar leeftijd, blouse of zachte trui, geen jeugdmode",
      ),
      vibe: styleByAge(
        "rustig, gewoon, een beetje verlegen, alledaags moment, geen pose",
        "rustig, ervaren, comfortabel met zichzelf, alledaags moment",
      ),
    };
  }
  if (attractiveness === "plain") {
    return {
      appearance: isDutchish
        ? `${age}-jarige Nederlandse vrouw, onopvallend gezicht, onregelmatige trekken, lichte acne of vlekjes, fletse huid, asymmetrische glimlach, eenvoudige haar zonder styling`
        : `${age}-year-old plain-looking woman, irregular features, blemished skin`,
      style: styleByAge(
        "simpele alledaagse kleren, vaak iets te ruim of niet helemaal passend, geen mode-bewustzijn",
        "simpele kleren passend bij haar leeftijd, soms iets te ruim of saai, geen mode-bewustzijn",
      ),
      vibe: "ingetogen, niet glamoureus, oprecht awkward candid moment",
    };
  }
  return {
    appearance: isDutchish
      ? `natuurlijke schoonheid, ${age}-jarige Nederlandse vrouw, rustige glimlach, lichte sproetjes, haar in een half-knot of losjes neergelaten`
      : `natural-looking ${age}-year-old woman, soft smile, light makeup, expressive eyes`,
    style: styleByAge(
      "casual everyday outfit, denim, comfortable, modern girl-next-door",
      "verzorgde leeftijdspassende outfit, een mooie blouse of zachte coltrui, denim of kokerbroek",
    ),
    vibe: styleByAge(
      "warm, een beetje verlegen, oprecht, candid moment",
      "warm, gracieus ouder, zelfverzekerd, oprechte candid",
    ),
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
  /** Concrete outfit for THIS shot. When provided, completely replaces
   * the persona's `photo_style.style` anchor for this single photo.
   *
   * Why we override instead of compose: if both the persona-level
   * style ("casual denim, oversized sweater") and a per-shot outfit
   * ("red satin going-out top") are in the prompt, diffusion
   * compromises and paints denim with a red accent — the result is
   * "same jacket every shot" because the persona-level token wins on
   * weight. Replacing yields three visibly different outfits in a
   * 3-photo gallery, which is what makes it look like a real photo
   * roll instead of one selfie copy-pasted three times. */
  outfit?: string;
  /** Concrete body language / pose for this shot. Same reasoning as
   * `outfit` — without an explicit pose token diffusion settles into
   * its default arms-by-side / shoulder-shot composition. */
  pose?: string;
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

  // Age tier — drives explicit anti-young anchors for 30+ subjects.
  // Without this the diffusion model defaults to "twentysomething face"
  // regardless of what `appearance` says, which is what the operator
  // hit with a 55-65 batch coming out as 30-year-olds.
  const personaAge =
    typeof profile.age === "number" && Number.isFinite(profile.age)
      ? profile.age
      : 25;
  const ageTier = ageToTier(personaAge);
  const ageAnchors = AGE_ANCHORS[ageTier];

  const defaults = deriveDefaults(profile, attractiveness);

  const appearance = (customStyle.appearance ?? defaults.appearance).trim();
  // Operator-supplied build wins; otherwise the body-type anchor
  // provides the silhouette description so we don't double-anchor.
  const build = (customStyle.build ?? "").trim();
  // Per-shot outfit (from a scene template) REPLACES the persona-level
  // style anchor for this photo. This is what makes a 3-photo gallery
  // actually show 3 different outfits instead of "denim jacket × 3".
  const cam0 = args.cameraStyle ?? {};
  const shotOutfit = (cam0.outfit ?? "").trim();
  const style = shotOutfit || (customStyle.style ?? defaults.style).trim();
  const shotPose = (cam0.pose ?? "").trim();
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
  // Concrete physical age cue (e.g. "fijne rimpels, grijze plukken bij
  // de slapen"). We attach this directly after appearance so the cue
  // lands together with face descriptors. Even when Grok wrote a
  // 25-coded appearance for a 60-year-old, this injects age tokens
  // explicitly. Soft for 50-64, stronger for 65+.
  const ageHint = ageHairAndSkinHint(personaAge);

  const promptParts: string[] = [];
  // Age anchor frontloads ABOVE the realism/appearance anchors for
  // anything past mid-20s — diffusion is order-sensitive and we need
  // the model to commit to the right age bracket before it sees the
  // appearance descriptors. We do NOT also end-load: doubling the age
  // signal causes overshoot (55 starts looking like 80).
  if (ageAnchors.positive) {
    promptParts.push(ageAnchors.positive);
  }
  if (attractiveness !== "striking") {
    promptParts.push(anchors.positive);
  }
  promptParts.push(appearance);
  if (ageHint) promptParts.push(ageHint);
  // Hard-coded hair length anchor — operator rule: ALL personas must
  // have medium-length or long hair, never very short / pixie / buzz cut.
  // This is end-loaded relative to `appearance` so it overrides any
  // short-hair tokens the diffusion base might commit to from the seed
  // alone.
  promptParts.push(
    "with medium-length to long hair reaching at least to the shoulders or longer, never short hair",
  );
  if (build) promptParts.push(build);
  promptParts.push(bodyAnchors.positive);

  // If the scene description contains explicit nude keywords, override
  // the persona's normal "wearing X" style and force full visible nudity.
  const isExplicitNude =
    /naakt|naakte|naaktfoto|topless|bloot|kutje|kut|kutje zichtbaar|borsten zichtbaar|gespreid|naakt.*bed|naakt.*spiegel|naakt.*liggend|naakt.*knie/i.test(
      cleanScene,
    );
  if (isExplicitNude) {
    promptParts.push(
      "completely nude, no clothes at all, bare skin, full frontal nudity, " +
        "breasts fully visible with nipples, vagina/pussy clearly visible and exposed, " +
        "legs spread wide, explicit nudity, no hands covering breasts or vagina",
    );
    // Self-taken explicit photo: MUST look like she took it herself.
    // This overrides the generic camera/capture later in the prompt.
    promptParts.push(
      "mirror selfie taken by the woman herself, she is holding her own phone, " +
        "arm extended or phone visible in the mirror reflection, selfie angle from her hand, " +
        "amateur bedroom or bathroom mirror selfie, real self-taken nude photo from her personal camera roll, " +
        "her own arm and hand visible in frame or reflection, casual unposed self-portrait",
    );
  } else {
    promptParts.push(`wearing ${style}`);
  }

  if (shotPose) promptParts.push(`pose: ${shotPose}`);
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
  let camera = (cam.camera ?? "casual phone selfie or candid snapshot").trim();
  const backdrop = (cam.backdrop ?? "").trim();
  let lighting = (cam.lighting ?? "soft natural lighting").trim();
  let capture = (cam.capture ?? "shot on iPhone, slight grain, intimate everyday moment").trim();

  // For explicit nudes we force a strong self-taken mirror-selfie look
  // so it is obvious that *she* took the photo (not a third party).
  if (isExplicitNude) {
    camera =
      "close-up mirror selfie taken by the woman herself, phone held in her own hand, " +
      "arm extended or clearly visible, phone camera reflection visible in the mirror, " +
      "selfie angle, amateur self-taken nude";
    lighting = "soft bedroom or bathroom lighting, mirror reflection, casual home environment";
    capture =
      "shot by herself on her own iPhone, real amateur mirror selfie, slightly imperfect framing and angle, " +
      "from her personal camera roll, unedited self-portrait, natural phone photo";
  }

  promptParts.push(camera);
  if (backdrop) promptParts.push(`background: ${backdrop}`);
  promptParts.push(lighting);
  promptParts.push(capture);

  // Anti-AI / pro-EVERYDAY-amateur anchors. End-loaded because diffusion
  // weights later tokens slightly higher for "look-and-feel" terms.
  // For explicit nudes we add an extra strong self-taken anchor so the
  // model cannot fall back to "someone else took this photo".
  if (isExplicitNude) {
    promptParts.push(
      "ordinary everyday iPhone mirror selfie from her own camera roll, totally unedited, " +
        "real self-taken amateur nude photo, slightly imperfect framing and angle, " +
        "her own hand and arm visible holding the phone or reflected in the mirror, " +
        "natural skin pores and small skin texture, no filter, no beauty filter, " +
        "normal phone camera dynamic range, slight ISO noise, slight grain, " +
        "shot quickly by herself in her bedroom or bathroom, regular phone photo not a photoshoot, " +
        "clearly taken by the woman in the photo, selfie, self-portrait",
    );
  } else {
    promptParts.push(
      "ordinary everyday iPhone snapshot from her camera roll, totally unedited, " +
        "boring weekday moment, daily life, nothing special happening, " +
        "real candid not posed, slightly imperfect framing, slightly off-center, " +
        "natural skin pores and small skin texture, no filter, no beauty filter, " +
        "no portrait mode bokeh, no shallow depth of field, " +
        "normal phone camera dynamic range, slight ISO noise, slight grain, " +
        "shot quickly in 2 seconds, regular phone photo not a photoshoot, " +
        "captured by a friend on their phone, looks like it was just sent in a group chat",
    );
  }

  promptParts.push("photorealistic, high detail, no text, no watermark, no logo");

  const prompt = promptParts.filter(Boolean).join(", ");

  // Negative prompt — base + tier-specific anti-glam terms + body-type
  // counterweights. We keep "ugly" out on purpose; we want realistic,
  // not deformed.
  //
  // The expanded anti-AI block is deliberate: operator reported "het
  // ziet er ook te ai uit", which usually means doll-like skin, perfect
  // symmetry, plastic-render finish. We push hard against those
  // specific failure modes here.
  const baseNegative =
    "deformed, distorted, blurry, lowres, extra fingers, mutated hands, " +
    "watermark, signature, text, logo, harsh studio lighting, " +
    "ai-generated look, ai art, ai render, ai illustration, generative art, " +
    "plastic skin, doll-like, porcelain doll, cgi, 3d render, octane render, " +
    "digital painting, illustration, anime, cartoon, stylised, " +
    "oversaturated, hdr, overprocessed, instagram filter, beauty filter, " +
    "smooth airbrushed skin, perfect symmetry, perfect composition, " +
    "studio portrait, magazine portrait, fashion editorial, photoshoot, " +
    "professional model pose, posed for camera, glamorous, " +
    // operator rule: medium or long hair only, never short
    "short hair, very short hair, pixie cut, buzz cut, shaved head, " +
    "boy cut, undercut, crew cut, bowl cut, cropped hair, ear-length hair, " +
    "above the ear hair, extremely short hairstyle, masculine haircut, " +
    // anti-styled / anti-professional — operator wants everyday phone
    // snaps, not curated content
    "professional photo, photoshoot, fashion shoot, model agency shot, " +
    "vogue, instagram, content creator photo, influencer photo, " +
    "carefully composed, golden hour magic, dramatic lighting, " +
    "color graded, lightroom preset, vsco, film simulation, " +
    "pinterest aesthetic, cottagecore, soft girl aesthetic, " +
    "DSLR, mirrorless camera, professional camera, telephoto lens, " +
    "shallow depth of field, bokeh background, blurred background, " +
    "stylish outfit, fashion outfit, designer clothing, dressed up, " +
    "full makeup, contoured face, styled hair, blow-dry, " +
    "duplicate person, multiple women, twins, identical twins, " +
    // anti-clothing (especially important for explicit nudes)
    "wearing clothes, shirt, top, jeans, pants, bra, panties, underwear, dress, jacket, hoodie, leggings, skirt, clothing, dressed, partially clothed, " +
    // anti-third-person / studio for explicit nudes
    "third person view, photographer, someone else took the photo, external camera, professional studio nude, studio lighting, " +
    "no phone visible, no mirror, no selfie, no arm visible, not self-taken";
  const negParts = [baseNegative];
  if (anchors.negative) negParts.push(anchors.negative);
  if (bodyAnchors.negative) negParts.push(bodyAnchors.negative);
  if (ageAnchors.negative) negParts.push(ageAnchors.negative);
  const negativePrompt = negParts.join(", ");

  return { prompt, seed, negativePrompt };
}
