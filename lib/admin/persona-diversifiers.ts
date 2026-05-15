/**
 * Persona diversifiers — concrete random ingredients we hand to Grok
 * per persona so a batch of personas with the same brief + tier ends
 * up looking like distinct humans, not slight variations of the same
 * template.
 *
 * Why this exists:
 *   With only "brief + attractiveness + body_type + age" as input,
 *   Grok converges on its statistical median ("blond, blue eyes, half-
 *   knot, Amsterdam, marketing intern, casual denim") for every
 *   persona in the batch. The diversifier picks a fresh set of
 *   concrete details per persona — hair colour, eye colour, region,
 *   occupation field, dress aesthetic, vibe lean — and injects them
 *   into the Grok user message as REQUIRED ingredients. The diffusion
 *   prompt then naturally inherits these from photo_style.appearance,
 *   so backdrop, face and outfit all diverge per persona.
 *
 * Each axis is a list of concrete values (specific is better — diffusion
 * latches onto specifics, not abstractions). We pick one per axis using
 * a Mulberry32 PRNG seeded by `index + Date.now()` so the same batch
 * call yields different combos but the call itself is reproducible if
 * the operator re-runs it (we still re-seed with Date.now() per call).
 */

const HAIR_COLORS = [
  "donkerblond haar",
  "asblond haar",
  "honingblond haar",
  "platinablond haar",
  "lichtbruin haar",
  "kastanjebruin haar",
  "donkerbruin haar",
  "zwart haar",
  "rossig roodbruin haar",
  "koperrood haar",
  "donkergrijs haar met grijze plukken",
] as const;

const HAIR_STYLES = [
  "schouderlang en steil",
  "lang met losse golven",
  "een korte bob",
  "een hoge slordige knot",
  "een lage paardenstaart",
  "in twee vlechtjes",
  "kort pixie-cut",
  "krullend en opgebonden",
  "lang en rommelig samengebonden",
  "een half-up half-down met knot",
  "blunt cut net boven de schouders",
] as const;

const EYE_COLORS = [
  "blauwe ogen",
  "lichtblauwe ogen",
  "groene ogen",
  "hazelbruine ogen",
  "warme bruine ogen",
  "donkerbruine ogen",
  "grijsblauwe ogen",
  "groen-grijze ogen",
] as const;

const SKIN_DETAILS = [
  "lichte sproetjes over neus en wangen",
  "rooskleurige huid die snel blost",
  "fletse winterhuid met blauwadertjes bij de slapen",
  "lichte zomerteint",
  "olijfkleurige huid",
  "blanke huid met enkele moedervlekjes",
  "lichte acne-littekens op de kin",
  "bleke huid en wallen onder de ogen",
  "een lichte tan met sproetjes op de schouders",
  "gladde rustige huid met een dof matte uitstraling",
] as const;

const FACE_SHAPES = [
  "een rond gezicht met volle wangen",
  "een hartvormig gezicht met smalle kin",
  "een ovaal gezicht met zachte lijnen",
  "een vierkant gezicht met sterke kaak",
  "een lang gezicht met hoog voorhoofd",
  "een rond gezicht met een dubbele kin",
  "uitgesproken jukbeenderen",
  "smalle kaak en kleine kin",
] as const;

// City names only — Grok copies these straight into `city`. We mix big
// cities, mid-size, and a few smaller towns so the discovery feed
// doesn't become "everyone in Amsterdam".
const NL_REGIONS = [
  "Amsterdam",
  "Rotterdam",
  "Utrecht",
  "Den Haag",
  "Eindhoven",
  "Tilburg",
  "Groningen",
  "Leeuwarden",
  "Breda",
  "Nijmegen",
  "Maastricht",
  "Arnhem",
  "Haarlem",
  "Almere",
  "Zwolle",
  "Enschede",
  "Delft",
  "Leiden",
  "Apeldoorn",
  "Doetinchem",
  "Roermond",
  "Alkmaar",
  "Hilversum",
  "Amersfoort",
  "Den Bosch",
  "Middelburg",
  "Assen",
] as const;

const OCCUPATION_FIELDS = [
  "studeert pedagogiek en werkt parttime in de kinderopvang",
  "verpleegkundige op de afdeling cardiologie",
  "freelance grafisch ontwerper",
  "barista in een specialty-koffiebar",
  "junior copywriter bij een reclamebureau",
  "fysiotherapeut in opleiding",
  "doet de master psychologie en is studentassistent",
  "werkt op een basisschool als juf",
  "freelance fotograaf, vooral bruiloften",
  "klantenservice bij een verzekeraar",
  "yoga-instructeur en deeltijd serveerster",
  "verkoopadviseur in een kledingwinkel",
  "junior data-analist bij een fintech",
  "social-media manager bij een kledingmerk",
  "tandartsassistente",
  "huidtherapeut in een kleine praktijk",
  "doet HBO journalistiek en schrijft voor de schoolkrant",
  "nail-tech met eigen studio aan huis",
  "kapster in een buurtsalon",
  "sportief actief als personal trainer",
  "horecamedewerker in een bistro",
  "magazijnmedewerker met avondopleiding",
  "starter bij een uitgeverij, redactie",
  "junior recruiter",
  "stagiair bij een advocatenkantoor",
  "verzorgende in een bejaardentehuis",
  "make-up artist freelance",
] as const;

const VIBE_LEANS = [
  "rustig en dromerig, denkt graag voor zichzelf",
  "spontaan en pittig, lacht hard",
  "warm en zorgend, vraagt hoe het met je gaat",
  "droog en ad-rem, houdt van slechte woordgrappen",
  "een beetje verlegen maar opent helemaal als ze comfortabel is",
  "extravert en luidruchtig met vriendinnen",
  "introvert, kleine groep maar diepe gesprekken",
  "sportief en avontuurlijk, altijd outdoors",
  "creatief en chaotisch, plant niets",
  "georganiseerd en doelgericht, lijstjes voor alles",
  "ondeugend en plagerig flirten",
  "filosofisch, stelt rare vragen om 23:00",
] as const;

const STYLE_AESTHETICS = [
  "casual denim en oversized sweaters, schone witte sneakers",
  "soft-girl-aesthetic met pasteltinten, parels en parfum",
  "athleisure: zwarte legging, crop top, hoodie",
  "modieus minimalistisch: lange jas, smalle broek, leren tas",
  "boho: lange rokken, meerdere armbandjes, halfopen haar",
  "streetwear met oversized hoodies en wide-leg jeans",
  "vintage en thrifted: 90's blazers, mom-jeans",
  "klassiek-mooie outfits: blouse, hoge taille broek",
  "alt-stijl: zwarte t-shirts, choker, dr. martens",
  "girl-next-door: zomerjurkjes en sneakers",
  "preppy: trui-over-blouse, parels, plooirok",
  "no-nonsense werkkleding: blazer, kokerrok, zachte trui",
] as const;

const HEIGHT_HINTS = [
  "klein en compact (rond 1m60)",
  "iets onder gemiddeld (rond 1m65)",
  "gemiddeld (rond 1m70)",
  "iets boven gemiddeld (rond 1m75)",
  "lang (rond 1m80)",
] as const;

export type PersonaDiversifier = {
  hair_color: string;
  hair_style: string;
  eye_color: string;
  skin: string;
  face_shape: string;
  region: string;
  occupation_field: string;
  vibe_lean: string;
  style_aesthetic: string;
  height: string;
};

/** Mulberry32 PRNG — deterministic given the seed but well-distributed.
 * Single-file copy so we don't pull in a dep. */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickFromArray<T>(arr: readonly T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)]!;
}

/** Produce a fully-populated diversifier set. The seed mixes the
 * persona's batch index with `Date.now()` so two batches with the same
 * brief still produce different combos, but within a single batch each
 * index lands on a distinct hash bucket. */
export function pickPersonaDiversifier(opts: {
  /** 0-based index in the current batch — keeps spread even within a
   * single Date.now() millisecond. */
  index: number;
  /** Optional extra entropy (e.g. brief hash) so two operators clicking
   * "generate" simultaneously also get different results. */
  extraSeed?: number;
}): PersonaDiversifier {
  const seed =
    ((opts.index | 0) * 0x9e3779b1) ^
    (Date.now() | 0) ^
    ((opts.extraSeed ?? 0) | 0);
  const rand = mulberry32(seed);
  return {
    hair_color: pickFromArray(HAIR_COLORS, rand),
    hair_style: pickFromArray(HAIR_STYLES, rand),
    eye_color: pickFromArray(EYE_COLORS, rand),
    skin: pickFromArray(SKIN_DETAILS, rand),
    face_shape: pickFromArray(FACE_SHAPES, rand),
    region: pickFromArray(NL_REGIONS, rand),
    occupation_field: pickFromArray(OCCUPATION_FIELDS, rand),
    vibe_lean: pickFromArray(VIBE_LEANS, rand),
    style_aesthetic: pickFromArray(STYLE_AESTHETICS, rand),
    height: pickFromArray(HEIGHT_HINTS, rand),
  };
}

/** Render a diversifier as a Grok-friendly bullet list that becomes
 * required ingredients for the persona. */
export function renderDiversifierBlock(d: PersonaDiversifier): string {
  return [
    "Concrete persoonlijke details die je voor deze persona MOET gebruiken (zorg dat appearance/build/style/vibe en bio/backstory hier consistent mee zijn — geen andere haarkleur, oogkleur of regio kiezen):",
    `- Haar: ${d.hair_color}, ${d.hair_style}`,
    `- Ogen: ${d.eye_color}`,
    `- Huid: ${d.skin}`,
    `- Gezicht: ${d.face_shape}`,
    `- Lengte: ${d.height}`,
    `- Woont in: ${d.region} (gebruik deze stad ook letterlijk als 'city')`,
    `- Wat ze doet: ${d.occupation_field}`,
    `- Vibe: ${d.vibe_lean}`,
    `- Stijl: ${d.style_aesthetic}`,
  ].join("\n");
}
