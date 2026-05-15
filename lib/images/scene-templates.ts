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
  // --- Avatar-friendly (close to face, recognizable) -------------------

  {
    scene: "thuis op de bank, gewone doordeweekse middag, kop thee in haar hand",
    camera: "casual phone selfie front camera, slightly tilted, head and shoulders framing, not perfectly centered",
    backdrop: "ordinary Dutch living room, sofa, a couple of plants, slightly messy",
    lighting: "plain window daylight, no special lighting",
    capture: "iPhone selfie, completely unedited, slightly grainy",
    outfit: "plain grey hoodie, no makeup, hair just down or in a messy bun",
    pose: "regular smile, looking at the phone, no styled pose, just hanging out",
    kind: "avatar",
  },
  {
    scene: "even snel een mirror selfie voor het naar buiten gaan, niks bijzonders",
    camera: "everyday mirror selfie with phone visible at chest, slightly off-center, normal three-quarter framing",
    backdrop: "ordinary bedroom mirror, normal cluttered shelf, daily life mess in the background",
    lighting: "plain bedroom overhead light, nothing dramatic",
    capture: "iPhone mirror selfie, unedited, normal phone camera quality",
    outfit: "plain white t-shirt and regular blue jeans, no jewellery, basic everyday outfit",
    pose: "phone held at chest, free hand just at her side, neutral or slight smile, not posing",
    kind: "avatar",
  },
  {
    scene: "in een normaal café aan een tafeltje, koffie voor zich, gewoon een doordeweekse pauze",
    camera: "everyday phone snapshot from across the table by a friend, normal framing, no portrait mode",
    backdrop: "ordinary café interior, simple wooden table, other ordinary people in the background",
    lighting: "normal café indoor light, nothing fancy",
    capture: "iPhone snapshot, unedited, taken in 2 seconds",
    outfit: "basic beige sweatshirt and jeans, hair just pulled back",
    pose: "elbows on the table, hands around the mug, casually looking up at the camera, no laugh-pose",
    kind: "avatar",
  },
  {
    scene: "buiten op een gewoon terrasje, even biertje of fris, niks gestyled",
    camera: "regular phone snapshot taken by a friend, slightly tilted, normal medium shot",
    backdrop: "ordinary Dutch terrace with regular parasols and parked bikes",
    lighting: "plain late afternoon daylight, no golden hour magic",
    capture: "iPhone snapshot, unedited",
    outfit: "plain black t-shirt, jeans, no jewellery, hair down naturally",
    pose: "casually looking at the camera, glass loosely held, normal half-smile",
    kind: "avatar",
  },
  {
    scene: "snelle auto-selfie voordat ze wegrijdt, alledaags moment",
    camera: "regular phone selfie with seatbelt visible, head and chest, slightly off-center",
    backdrop: "normal car interior, blurred everyday street through the windshield",
    lighting: "plain daylight through the windshield, nothing dramatic",
    capture: "iPhone selfie, unedited, daily life",
    outfit: "plain hoodie or sweater over a t-shirt, no makeup, hair in a low ponytail",
    pose: "seatbelt across her chest, looking at the camera with a small everyday smile, not posing",
    kind: "avatar",
  },
  {
    scene: "even op het balkon of in de tuin, alledaagse middag",
    camera: "regular phone snapshot at three-quarter angle, taken by a friend, normal framing",
    backdrop: "ordinary Dutch balcony or small back garden, regular plants, brick wall",
    lighting: "plain daylight, slightly overcast",
    capture: "iPhone snapshot, unedited",
    outfit: "soft sweater and joggers or simple jeans, very casual at-home outfit",
    pose: "leaning on the railing or fence with one forearm, just looking around, not posing for the camera",
    kind: "avatar",
  },
  {
    scene: "even pauze met de fiets bij een verkeerslicht, normaal moment in de stad",
    camera: "regular phone snapshot from the side by a friend, slightly tilted, framed from waist up",
    backdrop: "ordinary Dutch street with bike lane and brick facades",
    lighting: "plain daylight, soft overcast",
    capture: "iPhone snapshot, unedited",
    outfit: "plain rain jacket or windbreaker, regular jeans, basic backpack",
    pose: "one foot down at the curb, hands on the handlebars, head turned briefly toward camera, not smiling for the photo",
    kind: "avatar",
  },
  {
    scene: "borrel thuis met vrienden, niets bijzonders, woensdagavondje",
    camera: "regular phone snapshot taken at eye level by a friend, slightly out of focus",
    backdrop: "ordinary living room with other friends slightly visible behind, no fairy lights, normal home",
    lighting: "plain warm indoor light from a regular ceiling lamp",
    capture: "iPhone snapshot, unedited, slightly motion blurred",
    outfit: "plain comfortable t-shirt or sweatshirt and jeans, totally everyday outfit, not dressed up",
    pose: "mid-conversation, glass casually in hand, looking sideways at the camera with a small everyday smile",
    kind: "avatar",
  },
  {
    scene: "even leunend tegen een muur op een normale dag in de stad",
    camera: "regular phone snapshot from across, head and shoulders, slightly off-center",
    backdrop: "ordinary Dutch brick wall or canal bridge, nothing scenic",
    lighting: "plain afternoon light",
    capture: "iPhone snapshot by friend, unedited",
    outfit: "plain hoodie or simple jacket over a t-shirt, jeans, no makeup",
    pose: "leaning back against the wall, hands in pockets, neutral expression with maybe a small smile, not styled",
    kind: "avatar",
  },
  {
    scene: "even op een bankje met koffie-to-go, alledaags moment",
    camera: "regular phone snapshot from the side by a friend, normal framing",
    backdrop: "ordinary park bench with regular coffee cart visible behind",
    lighting: "plain midday daylight",
    capture: "iPhone snapshot, unedited",
    outfit: "plain comfortable sweater and basic jeans, scarf only if it's cold",
    pose: "sitting normally on the bench, takeaway cup in one hand, looking forward or slightly down, not posing",
    kind: "avatar",
  },

  // --- Gallery / activity (full-body, action, varied locations) --------

  {
    scene: "even op een bankje in het park, normale dag, niks bijzonders",
    camera: "regular phone snapshot from a few meters away, taken by a friend, full body visible, slightly off-center framing",
    backdrop: "ordinary Dutch park, regular bench, some trees, no autumn-special vibe",
    lighting: "plain daylight, slightly overcast or cloudy",
    capture: "iPhone snapshot, unedited",
    outfit: "plain hoodie, regular jeans, normal sneakers, small bag next to her on the bench",
    pose: "sitting normally on the bench, one leg crossed over the other, looking at the camera with a small smile, not styled",
    kind: "gallery",
  },
  {
    scene: "even wandelend over straat, doordeweekse middag",
    camera: "regular phone snapshot from the side, off-center, normal walking pose",
    backdrop: "ordinary Dutch street with bike lane and regular brick facades",
    lighting: "plain overcast daylight",
    capture: "iPhone snapshot, unedited",
    outfit: "plain denim jacket over a t-shirt, regular jeans, white sneakers, small backpack",
    pose: "captured mid-step walking, looking forward, hand casually in jacket pocket, not posing",
    kind: "gallery",
  },
  {
    scene: "even op de fiets, alledaags moment",
    camera: "regular phone snapshot from behind/side, slight motion blur, full body visible",
    backdrop: "ordinary Dutch street with bike lane and brick facades",
    lighting: "plain daylight, slightly overcast",
    capture: "iPhone snapshot, unedited",
    outfit: "plain windbreaker or jacket, regular jeans, normal sneakers, basic backpack",
    pose: "riding the bike, both hands on handlebars, head briefly turned toward the camera, no smile-for-camera",
    kind: "gallery",
  },
  {
    scene: "even op het strand op een gewone dag, niet zomers gestyled",
    camera: "regular phone snapshot from the side, full body, distant subject, slightly tilted",
    backdrop: "ordinary Dutch beach with grey sea, dunes, no scenic golden hour",
    lighting: "plain overcast daylight, cool tones",
    capture: "iPhone snapshot, unedited",
    outfit: "plain hoodie and rolled-up jeans, sneakers carried in one hand, no special outfit",
    pose: "standing on the wet sand, looking out at the sea in profile, hands in hoodie pocket",
    kind: "gallery",
  },
  {
    scene: "in haar keuken, gewoon eten maken, geen gestyled foodie-moment",
    camera: "regular phone snapshot from three-quarter angle, normal framing",
    backdrop: "ordinary small Dutch kitchen, mess of ingredients on counter",
    lighting: "plain warm indoor light from regular ceiling lamp",
    capture: "iPhone snapshot, unedited",
    outfit: "plain t-shirt and sweatpants or pyjama bottoms, hair in a messy bun, no apron-styling",
    pose: "leaning over a cutting board, focused on chopping, free hand steadying the food, not looking at camera",
    kind: "gallery",
  },
  {
    scene: "borrel of feestje thuis, gewone avond, niet uitgaan-look",
    camera: "regular phone snapshot at slight tilt, slightly out of focus",
    backdrop: "ordinary living room or kitchen with friends visible behind, normal home, no neon bar lights",
    lighting: "plain warm indoor light",
    capture: "iPhone snapshot, unedited, slight motion blur",
    outfit: "plain comfortable top and jeans, totally everyday outfit, no special party clothes, no makeup or very minimal",
    pose: "casually leaning against a counter or doorframe, glass loosely in hand, mid-conversation, looking sideways at the camera",
    kind: "gallery",
  },
  {
    scene: "snel even na het sporten, gewoon zweterig, geen gym-influencer pose",
    camera: "regular phone mirror selfie, three-quarter, gym mirror visible",
    backdrop: "ordinary gym mirror with random equipment behind, no fitness-influencer setup",
    lighting: "plain indoor fluorescent gym light",
    capture: "iPhone mirror selfie, unedited",
    outfit: "plain regular sports top and basic leggings, simple sneakers, hair in a messy ponytail",
    pose: "standing front-facing in the mirror, phone held at chest, towel over the shoulder, slightly tired-looking",
    kind: "gallery",
  },
  {
    scene: "lezend op de bank thuis, normale doordeweekse avond",
    camera: "regular phone snapshot at side angle, taken from a couple meters away",
    backdrop: "ordinary living room, blanket on the sofa, normal home mess",
    lighting: "plain warm side lamp light",
    capture: "iPhone snapshot, unedited",
    outfit: "plain oversized hoodie and lounge shorts or pyjama bottoms, fluffy socks, no styling",
    pose: "curled up sideways on the sofa with legs tucked beneath her, an open paperback in her lap, glancing up at the camera",
    kind: "gallery",
  },
  {
    scene: "even op een gewone vrijdagavond uit met vrienden, geen festival",
    camera: "regular phone snapshot full body or three-quarter from the side",
    backdrop: "ordinary outdoor square or street, regular people around, no festival staging",
    lighting: "plain evening light, normal street lamps",
    capture: "iPhone snapshot, unedited",
    outfit: "plain t-shirt or basic top, jeans, normal sneakers, no festival-styling",
    pose: "standing with friends, glass or beer in one hand, looking at the camera with a small everyday smile",
    kind: "gallery",
  },
  {
    scene: "thuis bij het raam, gewoon zittend met thee, doordeweekse middag",
    camera: "regular phone snapshot from across the room, slightly off-center",
    backdrop: "ordinary window with plants on the sill, normal home",
    lighting: "plain grey daylight from the window",
    capture: "iPhone snapshot, unedited",
    outfit: "plain sweater and leggings, hair down or in a messy clip, no styling",
    pose: "sitting on the windowsill in profile, knees up, mug in one hand, looking out the window",
    kind: "gallery",
  },
  // --- Extra everyday gallery variety so a 3-shot batch never repeats
  {
    scene: "even op de markt op zaterdag, niks bijzonders",
    camera: "regular phone snapshot from across a stall, slightly off-center",
    backdrop: "ordinary Dutch outdoor market with regular stalls",
    lighting: "plain midday daylight, slightly overcast",
    capture: "iPhone snapshot, unedited",
    outfit: "plain cardigan over a t-shirt, regular jeans, normal sneakers, small canvas tote",
    pose: "standing at an angle, holding a small market bag, looking briefly at the camera, half-smile",
    kind: "gallery",
  },
  {
    scene: "wandelingetje door het bos op een normale herfstdag",
    camera: "regular phone snapshot from the front, full body, slightly off-center",
    backdrop: "ordinary Dutch forest, normal trees, leaves on the ground, no mist-special",
    lighting: "plain diffused autumn daylight",
    capture: "iPhone snapshot, unedited",
    outfit: "plain wool or fleece coat, regular jeans, normal hiking sneakers, knit beanie",
    pose: "captured walking forward, hands in coat pockets, looking down at the leaves, no posing",
    kind: "gallery",
  },
  {
    scene: "thuis op de bank in lounge-kleren, doordeweekse avond, niks gestyled",
    camera: "regular phone snapshot from above, slight downward angle, intimate framing",
    backdrop: "ordinary living room, blanket on the sofa, normal home mess",
    lighting: "plain warm low evening lamp light",
    capture: "iPhone snapshot, unedited",
    outfit: "plain oversized t-shirt and pyjama shorts, no makeup, hair scraped back into a clip",
    pose: "lying back on the sofa, mug balanced on her chest, sleepy small smile up at the camera",
    kind: "gallery",
  },
  {
    scene: "even bij een museum of tentoonstelling, gewone bezoek",
    camera: "regular phone snapshot from the side, taken from behind her",
    backdrop: "ordinary museum gallery wall, normal museum hardwood floor",
    lighting: "plain museum overhead light",
    capture: "iPhone snapshot, unedited",
    outfit: "plain sweater and jeans, regular sneakers, simple shoulder bag",
    pose: "standing in profile, hands loose at her sides, head tilted as she looks at something on the wall",
    kind: "gallery",
  },
  {
    scene: "in de trein bij het raam, gewone reis",
    camera: "regular phone snapshot from the seat opposite, framed shoulders-up",
    backdrop: "ordinary Dutch train interior, blurred countryside through the window",
    lighting: "plain daylight from the window",
    capture: "iPhone snapshot, unedited",
    outfit: "plain comfortable sweater and jeans, earbuds in, no styling",
    pose: "head leaning against the window, one hand resting on her chin, gaze on the window, neutral expression",
    kind: "gallery",
  },
] as const;

function candidatesForSlot(slot: "avatar" | "gallery"): readonly SceneTemplate[] {
  return slot === "avatar"
    ? SCENE_TEMPLATES.filter((t) => t.kind === "avatar" || t.kind === "mixed")
    : SCENE_TEMPLATES;
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
