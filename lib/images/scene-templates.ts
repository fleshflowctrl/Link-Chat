/**
 * Scene templates for persona photo generation.
 *
 * Diffusion models will reproduce the prompt's framing and setting very
 * literally. If we always say "casual phone selfie at home, soft window
 * light", every photo for every persona looks like the same shot —
 * which is exactly what the operator hit ("alle achtergronden hetzelfde,
 * geen full-body, alleen selfies").
 *
 * Each template bundles:
 *   - scene     — wat ze doet, waar (free-form)
 *   - camera    — distance/angle/perspective for the model
 *   - backdrop  — visible background detail (varies the locations)
 *   - lighting  — mood lighting (varies the look)
 *   - capture   — capture-device feel (selfie vs friend's phone vs DSLR)
 *
 * The four "camera/backdrop/lighting/capture" axes replace the
 * previously hard-coded "casual phone selfie" tail in
 * buildPersonaPhotoPrompt, so every photo gets a different look.
 *
 * Categorisation: each template has a `kind` so callers can bias toward
 * face-forward shots when generating an avatar (recognizability) and
 * full-body / candid shots for gallery items.
 */

export type SceneTemplate = {
  scene: string;
  camera: string;
  backdrop: string;
  lighting: string;
  capture: string;
  /** Specific outfit for this shot. When present this OVERRIDES the
   * persona's `photo_style.style` anchor for this photo only — without
   * this, every gallery shot ends up with the same "denim jacket"
   * because the persona-level style locks the wardrobe. Each template
   * must specify its own outfit so a 3-photo gallery actually shows
   * three different outfits. Keep it concrete: "blue sundress with
   * thin straps", not "casual summer". */
  outfit: string;
  /** Specific pose / body language. Same reason as `outfit`: without
   * an explicit pose token diffusion keeps falling back to the same
   * arms-crossed shoulder shot. */
  pose: string;
  /** Avatar = mostly face visible. Gallery = wider / activity shot.
   * Mixed = either works. */
  kind: "avatar" | "gallery" | "mixed";
};

export const SCENE_TEMPLATES: readonly SceneTemplate[] = [
  // --- "Real Instagram-style" templates inspired by ordinary phone
  // photos: lens flares, sun glare, mid-action, looking-away. These
  // exist specifically to fight the "too AI / too perfect" failure mode
  // by anchoring on real-photo imperfections. -----------------------------
  {
    scene: "smalle Italiaanse stadsstraat 's avonds, weg van een uitgaansavond",
    camera: "regular phone snapshot full body from a few meters away, slight tilt, slightly overexposed face from streetlight",
    backdrop: "narrow old European street at night, warm yellow streetlight glow, dark stone wall and a closed wooden door, hint of an Italian flag",
    lighting: "harsh streetlight from behind/side, strong lens flare cutting across the face, dark shadow background",
    capture: "iPhone snapshot, unedited, visible streetlight lens flare across the frame",
    outfit: "sleeveless burgundy or wine-red top, regular dark jeans, simple silver wristwatch, hair loose past shoulders",
    pose: "standing relaxed on the sidewalk, arms loose at her sides, neutral half-smile, looking flatly at the camera not posing",
    kind: "gallery",
  },
  {
    scene: "stadszicht bij zonsondergang, even snel een foto laten maken",
    camera: "regular phone snapshot full body from a few meters away, taken by a friend, slight tilt",
    backdrop: "ordinary city intersection at sunset, palm trees, traffic lights, intensely orange and red overexposed sky",
    lighting: "low warm sunset light, blown-out orange sky, flat front lighting on her face from the camera direction",
    capture: "iPhone snapshot, unedited, oversaturated orange sky from phone HDR, sun-warmed skin tone",
    outfit: "oversized grey blazer over a plain black crop top, regular light blue jeans, small silver chain necklace, hands tucked in blazer pockets",
    pose: "standing on a crosswalk, hands in blazer pockets, slight squint from the sun, small relaxed smile, head turned slightly toward the camera",
    kind: "gallery",
  },
  {
    scene: "kleedkamer mirror selfie voordat ze de deur uitgaat",
    camera: "full body mirror selfie with phone clearly visible at face height, slightly tilted, three-quarter angle",
    backdrop: "ordinary home walk-in closet with shelves of clothes and bags, pale curtains, parquet floor",
    lighting: "plain bright indoor daylight from a window, slight shadow on the wall behind her",
    capture: "iPhone mirror selfie, unedited, phone reflection visible, normal phone camera quality",
    outfit: "fitted pink midi dress with side slit, small black quilted clutch held against her hip, simple black strappy heels, silver wristwatch",
    pose: "standing slightly turned to one side in front of the mirror, one knee bent slightly, free hand at her hip holding the clutch, looking down at the phone in her hand, soft smile",
    kind: "gallery",
  },
  {
    scene: "op een balkon met uitzicht op zee tijdens een vakantie",
    camera: "regular phone snapshot from a couple meters away, taken by a friend, three-quarter framing waist up",
    backdrop: "ordinary holiday balcony with horizontal metal railing, distant city houses on a hillside, ocean and palm tree visible",
    lighting: "harsh midday sun, slightly blown highlights on shoulders and chest, deep shadow under chin, strong directional sunlight",
    capture: "iPhone snapshot, unedited, slightly washed out, sunlit",
    outfit: "small red triangle bikini top, leopard-print sarong tied around the hips, layered thin gold necklaces, simple bracelets, no extras",
    pose: "standing at the balcony railing, one hand resting at her hip on the sarong, eyes slightly squinted from the sun, casual real-life smile, hair lightly windblown",
    kind: "gallery",
  },
  {
    scene: "rondsnuffelen op een vintage kledingmarkt op een zonnige zaterdag",
    camera: "regular phone snapshot from a meter away, three-quarter framing, slightly low angle",
    backdrop: "outdoor market with racks of vintage jackets behind her, brick city buildings in the background, blue sky with thin clouds",
    lighting: "bright direct sunlight, sharp shadow on the ground, harsh contrast on her face",
    capture: "iPhone snapshot, unedited, harsh sunny phone exposure",
    outfit: "cropped brown leather bomber jacket over a black top, baggy washed dark jeans, fluffy black-and-white cow-print shoulder bag, black rectangular sunglasses",
    pose: "both hands lifted to the back of her head adjusting her hair, head turned slightly to the side, sunglasses on, mouth slightly open, mid-action not posed",
    kind: "gallery",
  },
  {
    scene: "even op een zonnige trap in de zuidelijke Europese zon",
    camera: "regular phone snapshot from below, taken from a step lower, full body framing, slightly tilted",
    backdrop: "ordinary outdoor stone staircase with whitewashed wall on one side and hand-painted green and yellow ceramic tiles on the other",
    lighting: "bright direct overhead sun, sharp leg shadow on the steps, slight squint",
    capture: "iPhone snapshot, unedited, sunny phone exposure",
    outfit: "short fitted black mini dress with one diagonal strap, small dark logo-pattern shoulder bag, knee-high black leather boots",
    pose: "standing on a step turned slightly toward the camera, one hand holding sunglasses against her thigh, head slightly tilted, soft smile while looking down at the camera",
    kind: "gallery",
  },
  {
    scene: "wandeling door het herfstbos, even achterom kijken",
    camera: "regular phone snapshot from behind, full body, taken from a few meters back",
    backdrop: "ordinary autumn forest path with fallen yellow and brown leaves, tall bare trees on either side",
    lighting: "soft diffused autumn daylight, no harsh shadows",
    capture: "iPhone snapshot, unedited",
    outfit: "cropped striped white-and-blue oxford shirt over a black bralette, high-waisted light-wash wide jeans, plain white sneakers, sunglasses held in one hand",
    pose: "captured mid-step from behind, head turned over the shoulder back at the camera, half-smile, sunglasses dangling from one hand, the other hand at her hip",
    kind: "gallery",
  },
  {
    scene: "lunch op een terras tijdens een vakantie, glas wijn in de hand",
    camera: "regular phone snapshot from across the table, taken by the person opposite, framed waist up at slight downward angle",
    backdrop: "ordinary southern European restaurant balcony with painted blue window frames behind, potted flowers, hint of another building across the alley",
    lighting: "warm afternoon daylight from the side, slightly blown highlights through the window, soft shadow on the table",
    capture: "iPhone snapshot, unedited, table set with cutlery and a small dish in the foreground",
    outfit: "thin-strap red square-neck sundress, layered thin gold necklaces, small white quilted handbag visible on the table, no makeup or very minimal",
    pose: "sitting at the table holding a wine glass loosely up by the stem, head tilted slightly to the side, slight squint from the light, real candid smile not posed for the camera",
    kind: "gallery",
  },
  {
    scene: "snelle nachtfoto bij een bar of cafe, ergens in de stad",
    camera: "regular phone snapshot from a meter away, full body, slightly low angle, slight tilt",
    backdrop: "ordinary city street at night, warm yellow shop sign behind her, parked bicycles, dark cobblestones",
    lighting: "warm yellow shop signage glow on her hair and shoulder, dark night background, slight motion blur from low shutter speed",
    capture: "iPhone snapshot, unedited, slight noise from low light, slight motion blur on edges",
    outfit: "oversized black blazer worn over a short black mini dress, sheer black tights, knee-high black leather boots, small thin necklace",
    pose: "standing leaning a hand on a low metal railing or bike rack, ankles slightly crossed, neutral half-smile, looking forward at the camera, candid not posed",
    kind: "gallery",
  },
  {
    scene: "snelle thuis-mirror selfie voor het slapengaan",
    camera: "full body mirror selfie with phone clearly visible at chest height, slightly off-center",
    backdrop: "ordinary bedroom mirror, unmade bed visible in the reflection, normal closet door",
    lighting: "plain warm bedroom overhead light, slightly yellow cast",
    capture: "iPhone mirror selfie, unedited, phone reflection in frame",
    outfit: "plain oversized white t-shirt and grey shorts or boxer briefs, fluffy socks, hair in a messy bun, no makeup",
    pose: "standing front-facing in the mirror, phone held at chest with both hands, free thumb tapping the screen, neutral tired expression, no smile",
    kind: "gallery",
  },
  {
    scene: "een snelle eet-foto thuis, gewoon laten zien wat ze maakte",
    camera: "regular phone snapshot from above, slight downward angle, framed at chest with the food and her face visible",
    backdrop: "ordinary kitchen counter or small table, normal home in the background, no plating styling",
    lighting: "plain warm overhead kitchen light, slightly yellow",
    capture: "iPhone snapshot, unedited, slightly grainy",
    outfit: "plain oversized hoodie, hair scraped back, no makeup, small earrings",
    pose: "leaning over a plate of food held in one hand, other hand giving a small thumbs up, looking up at the camera with mouth slightly open mid-bite",
    kind: "gallery",
  },
  {
    scene: "zomeravond op de stoep voor de deur, even snel een foto",
    camera: "regular phone snapshot full body from a meter away, slightly low angle, off-center framing",
    backdrop: "ordinary residential street, parked cars, small front yard with hedge, evening sky",
    lighting: "soft fading evening light, long shadow on the pavement, warm tones",
    capture: "iPhone snapshot, unedited, slight grain",
    outfit: "plain white tank top and washed denim shorts, simple sneakers, small silver pendant necklace",
    pose: "standing slightly turned to the side, one foot crossed over the other, both hands at her sides, looking past the camera with a relaxed half-smile",
    kind: "gallery",
  },
] as const;

function candidatesForSlot(slot: "avatar" | "gallery"): readonly SceneTemplate[] {
  if (slot === "gallery") return SCENE_TEMPLATES;
  // Avatar slot prefers face-forward "avatar" / "mixed" templates so
  // the profile photo stays recognisable. If the template list happens
  // to contain none of those (e.g. operator deleted all avatar
  // templates while curating a new set), gracefully fall back to the
  // full list so we never crash with an empty candidate array.
  const avatarLike = SCENE_TEMPLATES.filter(
    (t) => t.kind === "avatar" || t.kind === "mixed",
  );
  return avatarLike.length > 0 ? avatarLike : SCENE_TEMPLATES;
}

/** Pick a scene template.
 *
 * Two selection modes, picked by which arg the caller provides:
 *
 *   - `variant: number`  →  round-robin: `variant % candidates.length`.
 *     Use this in bulk-generate so a batch of N personas walks the
 *     template list in order (variant = batchOffset + index) and no
 *     two personas in the batch can land on the same template
 *     (assuming N ≤ candidates.length). This is the right behaviour
 *     for batches because hash-based selection still gets birthday-
 *     paradox collisions at 10/11.
 *
 *   - `variant` omitted   →  deterministic hash on `personaId|slot`.
 *     Use this in single-shot retries (edit page "regenerate") so the
 *     same persona always lands on the same template until the
 *     operator explicitly cycles. Different personas spread through
 *     the set via the hash.
 *
 * `slot` always restricts the candidate set: "avatar" filters to
 * face-forward shots so the profile photo is recognisable, "gallery"
 * uses the full list with full-body and activity shots. */
export function pickSceneTemplate(opts: {
  personaId: string;
  slot: "avatar" | "gallery";
  /** When provided: round-robin index (modulo'd by candidate count).
   * When omitted: hash on personaId. */
  variant?: number;
}): SceneTemplate {
  const candidates = candidatesForSlot(opts.slot);
  if (typeof opts.variant === "number" && Number.isFinite(opts.variant)) {
    const v = ((Math.floor(opts.variant) % candidates.length) + candidates.length) %
      candidates.length;
    return candidates[v]!;
  }
  // Hash on persona id alone — single-shot retries should map to the
  // same template until the operator bumps `variant`.
  const key = `${opts.personaId}|${opts.slot}`;
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const idx = (h >>> 0) % candidates.length;
  return candidates[idx]!;
}
