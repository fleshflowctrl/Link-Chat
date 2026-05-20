import type { AppVariant } from "@/lib/app-variant";

/** v2 discover photo pipeline mode (bulk batch + manual regen). */
export type V2PhotoMode = "nude" | "sexy-clothed";

export function parseV2PhotoMode(raw: unknown): V2PhotoMode {
  if (raw === "sexy-clothed") return "sexy-clothed";
  return "nude";
}

/** Default operator brief for bulk v2 persona generation (FetLife / kink audience). */
export const V2_PERSONA_BULK_BRIEF = `Nederlandse vrouwen (22–42) voor een FetLife-achtige dating-app (v2).
Publiek: volwassenen die open staan voor kink, BDSM, poly, casual play en echte chemie — geen "vanilla Tinder" vibe.

Per persona:
- Bio (1e persoon): direct, zelfbewust, licht flirterig; noem 1–2 concrete voorkeuren (bv. rope, latex, dominant/sub/switch, voyeur, exhibition, club nights, aftercare).
- looking_for: kort en expliciet (play partner, FWB, dynamiek, events, nieuwsgierig verkennen).
- backstory + persona_meta: geloofwaardig NL-verhaal; kink mag genoemd worden maar niet pornografisch of grafisch.
- chat_style: flirterig, seksueel geladen, korte zinnen, dirty mind — open over verlangen/kink in chat; geen preuts of formeel smalltalk.
- interests: 3–5 chips die passen (events, latex, rope, nightlife, body positivity, etc.) met passende icons.
- funnel_intent_ids: kies uit casual, meaningful, friends, chatting, notsure — map semantiek: casual=play, meaningful=dynamiek, friends=munches/community.
- vibe_tags: 3–6 uit caring, romantic, playful, witty, chill, coffee, travel, movies, gym — kies wat bij haar persoonlijkheid past.
- filter_tags: links, active, online (minstens 2).
- photo_style: fotogeniek, volwassen, expliciet naakt — amateur self-taken (geen studio/boudoir).
  - style: bv. "completely nude amateur mirror selfie", "nude in bed dim light", "shower nude wet skin", "nude kneeling on bed".
  - vibe: intiem, rauw, imperfect belicht; geen glamour-shoot.
  - attractiveness: meestal average of plain; soms striking — nooit elk profiel hetzelfde.
- Geen clichés ("ik hou van reizen en wijn"), geen minderjarigen, geen expliciete porn-taal in bio.`;

/** v2 bulk brief when photos stay clothed but very sexy (lingerie / sheer / micro-bikini). */
export const V2_PERSONA_BULK_BRIEF_SEXY_CLOTHED = `Nederlandse vrouwen (22–42) voor een FetLife-achtige dating-app (v2).
Publiek: volwassenen die open staan voor kink, BDSM, poly, casual play en echte chemie — geen "vanilla Tinder" vibe.

Per persona:
- Bio (1e persoon): direct, zelfbewust, licht flirterig; noem 1–2 concrete voorkeuren (bv. rope, latex, dominant/sub/switch, voyeur, exhibition, club nights, aftercare).
- looking_for: kort en expliciet (play partner, FWB, dynamiek, events, nieuwsgierig verkennen).
- backstory + persona_meta: geloofwaardig NL-verhaal; kink mag genoemd worden maar niet pornografisch of grafisch.
- chat_style: flirterig, seksueel geladen, korte zinnen, dirty mind — open over verlangen/kink in chat; geen preuts of formeel smalltalk.
- interests: 3–5 chips die passen (events, latex, rope, nightlife, body positivity, etc.) met passende icons.
- funnel_intent_ids: kies uit casual, meaningful, friends, chatting, notsure.
- vibe_tags: 3–6 uit caring, romantic, playful, witty, chill, coffee, travel, movies, gym.
- filter_tags: links, active, online (minstens 2).
- photo_style: sexy met kleding — moet lijken op een **echte iPhone snap** (Instagram story / casual mirror selfie), NIET op een shoot.
  - style: beschrijf outfit + setting (bv. lingerie in messy bedroom, micro bikini vacation hotel, sports bra gym locker room). Borsten en schaamstreek bedekt door stof.
  - vibe: rauw, candid, imperfect belicht, lived-in omgeving, geen studio glamour, geen "perfect/flawless/goddess" taal.
  - attractiveness: meestal average of plain; soms striking — varieer per persona. Gebruik: attractive, natural, authentic, casual — NOOIT perfect/flawless/hyperrealistic.
- Geen clichés, geen minderjarigen, geen expliciete porn-taal in bio.`;

/** Extra system instructions appended to Grok when generating v2 personas. */
export const V2_PERSONA_SYSTEM_APPEND = `

VARIANT v2 (FetLife / kink community — HARDE REGELS):
- Dit is GEEN standaard dating-app. Persona's moeten passen bij een volwassen fetish/kink publiek.
- Bio en backstory: openhartig over grenzen, nieuwsgierigheid, rollen (dom/sub/switch/curious), events, play — in het Nederlands, niet kinderachtig.
- looking_for: expliciet maar niet vulgair (max 60 tekens).
- photo_style.style: beschrijf expliciet naakte amateur-foto's (completely nude, mirror selfie, bedroom, shower). Geen lingerie-only — v2 gebruikt de nude template-pool voor avatar én galerij.
- photo_style.vibe: rauw, intiem, imperfect belicht; amateur self-taken, geen studio glamour.
- chat_style: expliciet flirterig en seksueel geladen in gewone taal; voice_style bv. "kort, geil, plagerig" of "warm met bite, dirty jokes".
- funnel_intent_ids + vibe_tags: ALLEEN ids uit de bestaande schema-lijsten — kies de semantisch beste match voor een kinkster.
- personality_traits: bv. zelfverzekerd, nieuwsgierig, speels, dominant, submissief, open-minded (NL adjectieven).
- Vermijd "student marketing stage" clichés; varieer beroep (horeca, zorg, creatief, ondernemer, events, retail, IT, etc.).
`;

export const V2_PERSONA_SYSTEM_APPEND_SEXY_CLOTHED = `

VARIANT v2 — SEXY MET KLEDING (iPhone-realism, HARDE REGELS):
- Zelfde FetLife/kink publiek als v2 nude, maar foto's: lingerie, bikini, sheer, mesh — **niet volledig naakt**.
- Foto's moeten voelen als: RAW iPhone foto, candid mirror selfie, random vacation snap, amateur Instagram story — NOOIT professionele shoot, CGI, plastic, over-edited, te symmetrisch.
- Omgeving: messy bedroom, dirty bathroom mirror, hotel room, elevator, beach parking, restaurant bathroom — lived-in, niet luxe studio.
- photo_style.style: outfit + authentieke setting. Borsten/schaamstreek bedekt. Geen "completely nude", geen "bare breasts".
- photo_style.vibe: onbewerkt social-media gevoel, imperfect framing, flyaway hair, visible pores — geen glamour.
- Beschrijf haar NOOIT als: perfect, flawless, goddess, unreal body. Wel: attractive, natural, authentic, casual, confident.
- Bio/backstory/chat_style: zelfde open kink-toon als andere v2-persona's.
- funnel_intent_ids + vibe_tags: ALLEEN ids uit de bestaande schema-lijsten.
`;

/** End-loaded positive anchor for Z-Image sexy-clothed renders (no negative support on HF). */
export const V2_SEXY_CLOTHED_REALISM_ANCHOR =
  "RAW candid iphone 15 pro photo, casual instagram story aesthetic, amateur photography, unedited social media look, " +
  "accidentally real not artistically perfect, attractive natural authentic feminine woman not a model, " +
  "visible skin texture pores subtle cellulite flyaway hairs slight under-eye shadows asymmetrical face, " +
  "messy lived-in background wrinkled clothing awkward unposed posture uneven lighting realistic shadows, " +
  "slight motion blur from movement, imperfect framing off-center, mild compression artifacts, " +
  "realism over beauty authenticity over perfection casualness over cinematic quality, " +
  "NOT professional photoshoot NOT over-edited NOT CGI NOT plastic NOT overly symmetrical NOT too perfect NOT fantasy NOT AI generated look";

export function isV2PersonaVariant(variant: AppVariant | undefined): boolean {
  return variant === "v2";
}

export function defaultAttractivenessForVariant(
  variant: AppVariant | undefined,
): "striking" | "average" | "plain" {
  return isV2PersonaVariant(variant) ? "average" : "average";
}

/** Per-batch-index attractiveness spread for v2 (Z-Image ignores negatives). */
export const V2_ATTRACTIVENESS_CYCLE = [
  "average",
  "average",
  "striking",
  "plain",
  "average",
  "striking",
  "plain",
  "average",
] as const;

/** Per-batch-index body-type spread for v2 galleries. */
export const V2_BODY_TYPE_CYCLE = [
  "slim",
  "average",
  "average",
  "plus",
  "average",
  "slim",
  "plus",
  "average",
] as const;

export function v2AttractivenessForVariant(
  variant: number,
): "striking" | "average" | "plain" {
  const idx = Math.abs(Math.floor(variant)) % V2_ATTRACTIVENESS_CYCLE.length;
  return V2_ATTRACTIVENESS_CYCLE[idx]!;
}

export function v2BodyTypeForVariant(variant: number): "slim" | "average" | "plus" {
  const idx = Math.abs(Math.floor(variant)) % V2_BODY_TYPE_CYCLE.length;
  return V2_BODY_TYPE_CYCLE[idx]!;
}

export function defaultBulkBriefForVariant(
  variant: AppVariant | undefined,
  photoMode: V2PhotoMode = "nude",
): string {
  if (!isV2PersonaVariant(variant)) return "";
  return photoMode === "sexy-clothed"
    ? V2_PERSONA_BULK_BRIEF_SEXY_CLOTHED
    : V2_PERSONA_BULK_BRIEF;
}

export function v2SystemAppendForPhotoMode(mode: V2PhotoMode): string {
  return mode === "sexy-clothed"
    ? V2_PERSONA_SYSTEM_APPEND_SEXY_CLOTHED
    : V2_PERSONA_SYSTEM_APPEND;
}

export type V2ShotComposition = {
  scene: string;
  pose: string;
  camera: string;
  capture: string;
};

/** Lived-in iPhone compositions + matching outfits for sexy-clothed v2. */
export type V2SexyClothedShot = V2ShotComposition & {
  outfit: string;
  backdrop: string;
  lighting: string;
};

export const V2_SEXY_CLOTHED_COMPOSITION_CYCLE: readonly V2SexyClothedShot[] = [
  {
    scene: "messy apartment bedroom with wrinkled bedsheets and clothes on the floor",
    pose: "candid mirror selfie, slightly awkward posture, phone in hand, not perfectly centered",
    camera: "RAW iphone 15 pro candid mirror selfie, imperfect framing, amateur photography",
    capture: "unedited instagram story aesthetic, slight compression artifacts",
    outfit:
      "wearing tight black lace lingerie bra and panties, very revealing but clothed, breasts and crotch covered by fabric",
    backdrop: "slightly dirty bedroom mirror, lived-in messy room",
    lighting: "warm bedside lamp, uneven shadows on body",
  },
  {
    scene: "vacation hotel room with unmade bed and open suitcase",
    pose: "standing by window, casual vacation snap, wind in hair, looking slightly past camera",
    camera: "iphone vacation photo, candid not posed, shallow depth of field on background",
    capture: "random travel photo vibe, unedited phone camera",
    outfit: "micro bikini top and thong, nipples and genitals not visible, beach-trip energy",
    backdrop: "generic hotel room curtains and clutter",
    lighting: "harsh window daylight, uneven tan lines possible",
  },
  {
    scene: "small bathroom with toiletries on the counter and towel on hook",
    pose: "mirror selfie, leaning on sink, messy hair, tired candid expression",
    camera: "iphone bathroom mirror selfie, top-down phone angle, imperfect reflection",
    capture: "casual instagram story, fluorescent bathroom look",
    outfit: "sheer mesh bodysuit over skin, see-through but still wearing clothes",
    backdrop: "tiled wall, slightly foggy or smudged mirror",
    lighting: "cool bathroom fluorescent, flat phone flash",
  },
  {
    scene: "beach parking lot near cars, sand on flip-flops",
    pose: "walking toward camera, slight motion blur, wind-blown hair, casual vacation moment",
    camera: "amateur iphone photo, off-center framing, harsh outdoor light",
    capture: "vacation candid, compression from phone upload",
    outfit: "colorful micro bikini, breasts covered by bikini top, natural beach look",
    backdrop: "parked cars and pavement, blurred tourists far behind",
    lighting: "harsh midday sunlight, squinting possible",
  },
  {
    scene: "elevator with beige walls and scratched metal doors",
    pose: "quick elevator selfie, arm extended, slightly tilted frame, unglamorous angle",
    camera: "iphone elevator mirror or front camera, awkward close framing",
    capture: "random night-out story aesthetic",
    outfit: "tight mini dress with visible bra straps underneath, sexy but clothed",
    backdrop: "elevator interior, scuffed walls",
    lighting: "harsh overhead elevator bulb, unflattering shadows",
  },
  {
    scene: "gym changing room with open lockers and gym bag on bench",
    pose: "sitting on bench tying shoe, athletic candid, not modeling for camera",
    camera: "phone snapshot from locker room mirror, medium distance",
    capture: "post-workout amateur photo, grain in low light",
    outfit: "sports bra and tiny thong, stomach and legs visible, breasts covered",
    backdrop: "lockers, towels, fluorescent gym interior",
    lighting: "flat gym fluorescents, mixed shadows",
  },
  {
    scene: "restaurant bathroom with paper towel dispenser and dim tiles",
    pose: "mirror selfie mid-night out, lipstick slightly smudged, playful tired look",
    camera: "iphone mirror selfie, yellow indoor light, imperfect crop",
    capture: "night-out instagram story, unedited",
    outfit: "red satin lingerie-style top and skirt set, not topless, straps visible",
    backdrop: "small cramped bathroom, lived-in details",
    lighting: "warm yellow tungsten, uneven skin tone",
  },
  {
    scene: "casual apartment kitchen with fridge magnets and dishes in sink",
    pose: "leaning on counter, morning coffee vibe, relaxed unposed stance",
    camera: "iphone morning light snapshot, candid instagram aesthetic",
    capture: "everyday at-home photo, not a photoshoot",
    outfit: "oversized t-shirt and tiny shorts, underwear implied, casual sexy homewear",
    backdrop: "kitchen clutter, morning sun through window",
    lighting: "soft morning window light with shadows",
  },
] as const;

export function v2SexyClothedCompositionForVariant(variant: number): V2SexyClothedShot {
  const idx =
    Math.abs(Math.floor(variant)) % V2_SEXY_CLOTHED_COMPOSITION_CYCLE.length;
  return V2_SEXY_CLOTHED_COMPOSITION_CYCLE[idx]!;
}

export function v2SexyClothedOutfitForVariant(variant: number): string {
  return v2SexyClothedCompositionForVariant(variant).outfit;
}

/** Rotate camera families across v2 batch gallery/avatar shots. */
export const V2_NUDE_DIVERSITY_CYCLE = [
  "mirror",
  "low",
  "high",
  "close",
  "side",
] as const;

export type V2NudeDiversity = (typeof V2_NUDE_DIVERSITY_CYCLE)[number];

export function v2NudeDiversityForVariant(variant: number): V2NudeDiversity {
  const idx = Math.abs(Math.floor(variant)) % V2_NUDE_DIVERSITY_CYCLE.length;
  return V2_NUDE_DIVERSITY_CYCLE[idx]!;
}
