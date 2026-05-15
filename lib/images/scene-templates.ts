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
  /** Avatar = mostly face visible. Gallery = wider / activity shot.
   * Mixed = either works. */
  kind: "avatar" | "gallery" | "mixed";
};

export const SCENE_TEMPLATES: readonly SceneTemplate[] = [
  // --- Avatar-friendly (close to face, recognizable) -------------------

  {
    scene: "thuis op de bank, kop koffie of thee in haar hand, kijkt licht glimlachend in de camera",
    camera: "phone selfie front camera, arm extended, slight downward angle, head and shoulders framing",
    backdrop: "modern Dutch living room interior, plants, soft cushions",
    lighting: "soft window daylight, warm tones",
    capture: "phone selfie",
    kind: "avatar",
  },
  {
    scene: "voor de spiegel in haar slaapkamer, casual outfit, hand op heup",
    camera: "mirror selfie with phone visible at her chest, three-quarter or chest-up framing",
    backdrop: "bedroom mirror, slightly cluttered shelf with books and small plants",
    lighting: "indoor warm overhead light, slight underexposure",
    capture: "mirror selfie",
    kind: "avatar",
  },
  {
    scene: "in een gezellig café aan een tafeltje, kop koffie voor zich, leunt voorover",
    camera: "candid medium shot from across the table, slight bokeh on background",
    backdrop: "Amsterdam-style café interior, warm wood and brass, blurred patrons behind",
    lighting: "warm interior tungsten light, low-key cozy",
    capture: "iPhone candid",
    kind: "avatar",
  },
  {
    scene: "buiten op een terrasje, glas wijn of fris in haar hand, lacht naar iemand naast de camera",
    camera: "candid medium shot at three-quarter angle, slight tilt",
    backdrop: "Dutch terrace with parasols, parked bikes, brick facade behind",
    lighting: "late afternoon golden hour",
    capture: "phone candid by friend",
    kind: "avatar",
  },
  {
    scene: "auto-selfie op de bestuurdersplaats, leuke outfit, klaar om weg te gaan",
    camera: "phone selfie with seatbelt visible, head and chest framing, slight side angle",
    backdrop: "car interior, blurred windshield with daylight",
    lighting: "natural daylight through the windshield",
    capture: "phone selfie",
    kind: "avatar",
  },
  {
    scene: "in haar tuin of op het balkon, leunt op het hek, lichte glimlach",
    camera: "candid medium shot at three-quarter angle, taken by friend",
    backdrop: "Dutch garden or apartment balcony, planted pots, brick wall",
    lighting: "late afternoon natural light",
    capture: "phone candid by friend",
    kind: "avatar",
  },
  {
    scene: "op de fiets stilstaand voor een verkeerslicht, hoofd half gedraaid naar de camera",
    camera: "candid medium shot from the side, slight angle, framed from waist up",
    backdrop: "Amsterdam street with bike lane and tram rails behind",
    lighting: "natural daylight, soft overcast",
    capture: "phone candid by friend",
    kind: "avatar",
  },
  {
    scene: "op een feestje thuis met vrienden, glas in haar hand, lacht naar de camera",
    camera: "candid medium shot, taken at eye level by a friend, slight bokeh",
    backdrop: "living room with string lights and other guests blurred behind",
    lighting: "warm interior with soft fairy lights",
    capture: "phone candid by friend",
    kind: "avatar",
  },
  {
    scene: "uitstapje in de stad, leunt tegen een muur of brug, kijkt rustig in de camera",
    camera: "candid three-quarter shot from across, head and shoulders framing",
    backdrop: "urban Dutch backdrop — old brick wall or canal bridge",
    lighting: "soft afternoon light",
    capture: "phone candid by friend",
    kind: "avatar",
  },
  {
    scene: "op een bankje voor een koffiekarretje, papieren beker in haar hand",
    camera: "candid medium shot from the side, head tilted slightly toward camera",
    backdrop: "park bench with coffee cart visible behind, urban green",
    lighting: "midday natural light, soft shadows",
    capture: "phone candid by friend",
    kind: "avatar",
  },

  // --- Gallery / activity (full-body, action, varied locations) --------

  {
    scene: "op een bankje in het Vondelpark, leunt naar achter en lacht naar de camera",
    camera: "full body shot from a few meters away, taken by a friend, wide framing",
    backdrop: "Vondelpark autumn leaves on the ground, trees behind",
    lighting: "golden hour late afternoon, warm soft light",
    capture: "DSLR by friend",
    kind: "gallery",
  },
  {
    scene: "wandelend over een Amsterdamse gracht, kijkt opzij naar iets in de verte",
    camera: "candid three-quarter shot from the side, off-center composition, walking pose",
    backdrop: "Dutch canal with houseboats and bridge, leaning brick canal houses",
    lighting: "overcast soft daylight",
    capture: "candid phone by friend",
    kind: "gallery",
  },
  {
    scene: "fietsend op een Nederlandse straat, glimlacht over haar schouder naar de camera",
    camera: "candid full body action shot, slight motion blur on the bike, three-quarter angle from behind",
    backdrop: "Dutch street with bike lane, brick facades, other cyclists in distance",
    lighting: "natural daylight, slightly overcast",
    capture: "phone candid by friend",
    kind: "gallery",
  },
  {
    scene: "op het strand bij Scheveningen, blote voeten in het zand, kijkt uit over de zee",
    camera: "wide three-quarter shot from slightly behind, full body, looking away from camera",
    backdrop: "Dutch North Sea coast, dunes, scattered shells, slightly windy",
    lighting: "soft overcast sea light, cool tones",
    capture: "phone candid by friend",
    kind: "gallery",
  },
  {
    scene: "in haar keuken, kookt iets, haar in een knot, geconcentreerd",
    camera: "candid medium shot at three-quarter angle, taken by partner",
    backdrop: "small Dutch kitchen, ingredients on counter, hanging utensils",
    lighting: "warm interior evening light, slightly low ambient",
    capture: "phone candid by friend",
    kind: "gallery",
  },
  {
    scene: "uit met vrienden in een bar, glas in haar hand, dressed up",
    camera: "candid medium shot at slight tilt, shallow depth of field",
    backdrop: "bar interior at night, blurred colored lights and patrons behind",
    lighting: "moody night ambient with warm and neon accents",
    capture: "phone candid by friend",
    kind: "gallery",
  },
  {
    scene: "na een workout in de sportschool, handdoek om de nek, gezicht licht rood",
    camera: "phone mirror selfie, full body or three-quarter, gym mirror visible",
    backdrop: "gym mirror, rack of dumbbells visible behind, gym equipment",
    lighting: "bright indoor fluorescent",
    capture: "mirror selfie",
    kind: "gallery",
  },
  {
    scene: "lezend op een bank thuis, benen onder zich gevouwen, kijkt op van haar boek",
    camera: "candid medium shot at side angle, taken by someone else in the room",
    backdrop: "cozy living room, blanket, side lamp, plants",
    lighting: "warm side lamp light, slightly low-key",
    capture: "phone candid",
    kind: "gallery",
  },
  {
    scene: "op een festival of concert, lacht met haar handen omhoog, mensen om haar heen",
    camera: "candid full body or three-quarter shot from the side, action moment",
    backdrop: "festival crowd, distant stage lights, dust haze",
    lighting: "evening festival lights, warm with cool stage accents",
    capture: "phone candid by friend",
    kind: "gallery",
  },
  {
    scene: "thuis bij het raam, leest boek op een regenachtige dag, kop thee naast zich",
    camera: "candid wider shot from across the room, full upper body, profile angle",
    backdrop: "rainy window with raindrops, plants on windowsill",
    lighting: "cool grey daylight from the window",
    capture: "phone candid",
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
