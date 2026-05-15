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

/** Body shape tier — duplicated here from persona-payload to keep this
 * module self-contained. */
type BodyType = "slim" | "average" | "plus";

/** Constraints on which (body_type, age) combinations a given occupation
 * fits. A fitness instructor can't be plus-size; a "junior copywriter"
 * can't be 60. Defaults are unrestricted. */
type OccupationOption = {
  text: string;
  /** Compatible body types. Default: all three. */
  bodyTypes?: ReadonlyArray<BodyType>;
  /** Min age (inclusive). Default: 18. */
  ageMin?: number;
  /** Max age (inclusive). Default: 99. */
  ageMax?: number;
};

const OCCUPATION_FIELDS: ReadonlyArray<OccupationOption> = [
  // --- Pretty universal: any body type, broad age range ---------------
  { text: "verpleegkundige op de afdeling cardiologie", ageMin: 22 },
  { text: "freelance grafisch ontwerper", ageMin: 22 },
  { text: "barista in een specialty-koffiebar", ageMin: 18, ageMax: 35 },
  { text: "werkt op een basisschool als juf", ageMin: 23 },
  { text: "freelance fotograaf, vooral bruiloften", ageMin: 22 },
  { text: "klantenservice bij een verzekeraar", ageMin: 19 },
  { text: "verkoopadviseur in een kledingwinkel", ageMin: 19, ageMax: 45 },
  { text: "social-media manager bij een kledingmerk", ageMin: 22, ageMax: 40 },
  { text: "tandartsassistente", ageMin: 20 },
  { text: "huidtherapeut in een kleine praktijk", ageMin: 24 },
  { text: "nail-tech met eigen studio aan huis", ageMin: 21 },
  { text: "kapster in een buurtsalon", ageMin: 21 },
  { text: "horecamedewerker in een bistro", ageMin: 19, ageMax: 45 },
  { text: "magazijnmedewerker met avondopleiding", ageMin: 18, ageMax: 35 },
  { text: "verzorgende in een bejaardentehuis", ageMin: 22 },
  { text: "make-up artist freelance", ageMin: 21 },

  // --- Junior / student-coded: hard age cap so 50+ doesn't get them ---
  { text: "studeert pedagogiek en werkt parttime in de kinderopvang", ageMin: 18, ageMax: 26 },
  { text: "junior copywriter bij een reclamebureau", ageMin: 22, ageMax: 30 },
  { text: "fysiotherapeut in opleiding", ageMin: 19, ageMax: 26 },
  { text: "doet de master psychologie en is studentassistent", ageMin: 22, ageMax: 28 },
  { text: "junior data-analist bij een fintech", ageMin: 22, ageMax: 30 },
  { text: "doet HBO journalistiek en schrijft voor de schoolkrant", ageMin: 18, ageMax: 25 },
  { text: "starter bij een uitgeverij, redactie", ageMin: 22, ageMax: 30 },
  { text: "junior recruiter", ageMin: 22, ageMax: 30 },
  { text: "stagiair bij een advocatenkantoor", ageMin: 19, ageMax: 25 },

  // --- Body-type sensitive: physical professions can't be plus --------
  // Operator brief: "een fitness instructeur kan niet dik zijn en moet
  // eigenlijk altijd wel slank zijn". Same for dance / modelling / pro
  // sports — these careers self-select on body type in the real world.
  {
    text: "yoga-instructeur en deeltijd serveerster",
    bodyTypes: ["slim", "average"],
    ageMin: 22,
    ageMax: 50,
  },
  {
    text: "sportief actief als personal trainer",
    bodyTypes: ["slim", "average"],
    ageMin: 22,
    ageMax: 50,
  },
  {
    text: "fitness instructeur in een sportschool",
    bodyTypes: ["slim", "average"],
    ageMin: 22,
    ageMax: 50,
  },
  {
    text: "danslerares bij een dansschool",
    bodyTypes: ["slim", "average"],
    ageMin: 22,
    ageMax: 50,
  },
  {
    text: "professioneel model voor een agency",
    bodyTypes: ["slim"],
    ageMin: 18,
    ageMax: 35,
  },
  {
    text: "loopt halve marathons en werkt als hardloop-coach",
    bodyTypes: ["slim", "average"],
    ageMin: 25,
    ageMax: 55,
  },

  // --- Senior-friendly (40+, 50+, 65+) -------------------------------
  // The occupation pool was previously skewed toward 20-30 jobs. For
  // older personas we need believable mid-/late-career roles.
  { text: "kapster met eigen salon, al 20 jaar", ageMin: 40 },
  { text: "wijkverpleegkundige met meer dan 15 jaar ervaring", ageMin: 38 },
  { text: "juf op een basisschool, al 15 jaar voor de klas", ageMin: 38 },
  { text: "manager bij een verzekeraar", ageMin: 35 },
  { text: "office manager bij een advocatenkantoor", ageMin: 35 },
  { text: "boekhouder voor een MKB-bedrijfje", ageMin: 35 },
  { text: "praktijkmanager bij een huisartsenpraktijk", ageMin: 38 },
  { text: "secretaresse bij een notariskantoor, al jaren", ageMin: 38 },
  { text: "thuiszorgmedewerker met flexibele uren", ageMin: 30 },
  { text: "vrijwilligerswerk bij de voedselbank, parttime in de zorg", ageMin: 50 },
  { text: "gepensioneerd verpleegkundige, doet vrijwilligerswerk", ageMin: 62 },
  { text: "zelfstandig verkoper op de markt", ageMin: 35 },
  { text: "hovenier met eigen klein bedrijf", ageMin: 30 },
  { text: "eigenaar van een kleine boetiek in het centrum", ageMin: 35 },
];

/** Pick the best-fitting occupation given body type and age constraints.
 * Falls back to the unrestricted pool if no match (defensive — unlikely
 * given how broad most entries are). */
function pickOccupation(
  rand: () => number,
  bodyType: BodyType | undefined,
  age: number | undefined,
): string {
  const candidates = OCCUPATION_FIELDS.filter((opt) => {
    if (bodyType && opt.bodyTypes && !opt.bodyTypes.includes(bodyType)) return false;
    if (typeof age === "number") {
      if (typeof opt.ageMin === "number" && age < opt.ageMin) return false;
      if (typeof opt.ageMax === "number" && age > opt.ageMax) return false;
    }
    return true;
  });
  // Defensive fallback: if filters somehow leave us with nothing (e.g.
  // age 95 + plus body type, beyond our seniors), we drop the body-type
  // filter first, then the age filter, before giving up entirely.
  const pool = candidates.length > 0
    ? candidates
    : OCCUPATION_FIELDS.filter((opt) => {
        if (typeof age !== "number") return true;
        if (typeof opt.ageMin === "number" && age < opt.ageMin) return false;
        if (typeof opt.ageMax === "number" && age > opt.ageMax) return false;
        return true;
      });
  const finalPool = pool.length > 0 ? pool : OCCUPATION_FIELDS;
  return finalPool[Math.floor(rand() * finalPool.length)]!.text;
}

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
 * index lands on a distinct hash bucket.
 *
 * `bodyType` and `age` constrain the occupation pool — a fitness
 * instructor can't be plus-size, a "junior copywriter" can't be 60.
 * Pass them when known so the pick lands in a believable combination. */
export function pickPersonaDiversifier(opts: {
  /** 0-based index in the current batch — keeps spread even within a
   * single Date.now() millisecond. */
  index: number;
  /** Optional extra entropy (e.g. brief hash) so two operators clicking
   * "generate" simultaneously also get different results. */
  extraSeed?: number;
  /** Body type (slim/average/plus) — filters the occupation pool. */
  bodyType?: BodyType;
  /** Persona age — filters the occupation pool. */
  age?: number;
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
    occupation_field: pickOccupation(rand, opts.bodyType, opts.age),
    vibe_lean: pickFromArray(VIBE_LEANS, rand),
    style_aesthetic: pickFromArray(STYLE_AESTHETICS, rand),
    height: pickFromArray(HEIGHT_HINTS, rand),
  };
}

/** Age-appropriate hair colour palettes. Default HAIR_COLORS is skewed
 * toward the 20-40 range; for older personas we replace the pick with
 * something believable. Calibration matters: 55-year-olds in real life
 * very often have dyed hair (still look brown/blonde); only at 65+ does
 * grey dominate. The 50-64 palette intentionally includes "geverfd"
 * (dyed) options so the batch doesn't all look elderly. */
const HAIR_COLORS_50_TO_64 = [
  "geverfd donkerbruin haar",
  "geverfd kastanjebruin haar met grijze uitgroei",
  "donkerblond haar met grijze plukken bij de slapen",
  "lichtbruin haar met enkele grijze haartjes",
  "geverfd lichtbruin haar",
  "donker haar met subtiele grijze plukken",
  "zout-en-peper haar",
  "geverfd auburn haar",
] as const;

const HAIR_COLORS_65PLUS = [
  "grijs haar",
  "wit-grijs haar",
  "zilvergrijs kort haar",
  "kort grijs haar met krullen",
  "geverfd lichtbruin haar met grijze uitgroei",
  "donkergrijs haar",
] as const;

/** Returns an age-overridden diversifier when the picked hair colour
 * clashes with the persona's age (e.g. platinablond on a 70-year-old).
 * Threshold is 50: below that the default palette is fine.
 *
 * For 50-64 we use a *soft* palette that includes dyed/coloured options
 * so 55-year-olds don't all come out looking 70+. The diffusion
 * age-anchor handles the broader age bracket; this just keeps Grok's
 * appearance text and the photo consistent. */
export function applyAgeOverride(
  d: PersonaDiversifier,
  age: number,
): PersonaDiversifier {
  if (age < 50) return d;
  let hash = 0;
  for (let i = 0; i < d.hair_color.length; i++) {
    hash = (hash * 31 + d.hair_color.charCodeAt(i)) >>> 0;
  }
  const palette = age >= 65 ? HAIR_COLORS_65PLUS : HAIR_COLORS_50_TO_64;
  const newHair = palette[hash % palette.length]!;
  // Skin gets a subtle cue for 50-64, stronger for 65+. We don't
  // override if the original already mentions wrinkles/age.
  const skinHasAge = /rimpel|ouderdom|wrinkle|age/i.test(d.skin);
  const ageSkin = age >= 65
    ? "duidelijke rimpels rond ogen en mond, oudere huidstructuur"
    : "fijne rimpels rond ogen en mond, volwassen huidstructuur";
  return {
    ...d,
    hair_color: newHair,
    skin: skinHasAge ? d.skin : `${d.skin}, ${ageSkin}`,
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
