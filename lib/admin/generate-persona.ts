/**
 * Auto-generate a complete persona profile via Grok.
 *
 * The admin form supports ~30 fields across identity, bio, persona-depth,
 * chat-style and photo-style. Filling those in by hand for every persona
 * is tedious — this module turns a one-paragraph brief plus a variation
 * hint into a fully-shaped JSON object the persona-payload validator can
 * consume.
 *
 * Quality goals:
 *   - Each persona feels like a distinct human, not a copy of the brief.
 *   - All required fields are present; optional ones are populated by
 *     default because empty fields make the chat sound generic.
 *   - In a batch, personas vary in age/city/occupation/vibe so the user
 *     sees a believable spread on /discover.
 *
 * Parsing strategy:
 *   - Force JSON output via the `instructions` channel.
 *   - On parse failure we re-prompt once with the raw output and explicit
 *     "fix this so it's valid JSON" instruction. After two failures we
 *     surface the error to the caller; the UI shows it as a warning and
 *     moves on to the next persona instead of aborting the whole batch.
 */

import { grokResponsesComplete } from "@/lib/xai/grok-responses";
import { FUNNEL_LOOKING_ID_SET, FUNNEL_VIBE_ID_SET } from "@/data/funnel";
import {
  applyAgeOverride,
  pickPersonaDiversifier,
  renderDiversifierBlock,
  type PersonaDiversifier,
} from "@/lib/admin/persona-diversifiers";

const SYSTEM_PROMPT = `Je genereert een persona voor een Nederlandse AI-dating-app.

Output STRIKT geldige JSON, niets anders. Geen markdown-fences, geen
toelichting, geen voor- of natekst — alleen één JSON-object dat exact het
onderstaande schema volgt.

Doel:
- De persona moet voelen als een echt, herkenbaar Nederlands persoon van
  vandaag — niet een stockfoto-cliché. Ze heeft een eigen stem, eigen
  hobby's, eigen frustraties.
- Backstory en persona_meta zijn waar de diepte zit; vul ze rijk in (de
  AI gebruikt dit voor authentieke callbacks in chat).
- Photo_style is concreet en specifiek genoeg om herkenbare foto's te
  genereren met een diffusion-model.

Schema (alle velden verplicht tenzij gemarkeerd):

{
  "id": "string",                 // url-slug, kleine letters, 3–24 tekens, uniek-aanvoelend
  "display_name": "string",       // voornaam (max 24 tekens)
  "age": 22,                       // 19–42
  "city": "string",                // Nederlandse stad
  "occupation": "string",          // beroep of bezigheid in NL, kort
  "bio": "string",                 // 1–3 zinnen, 80–220 tekens, voelt als haar eigen profieltekst
  "looking_for": "string",         // 1 regeltje, max 60 tekens
  "backstory": "string",           // 2–4 alinea's: jeugd, familie, recent jaar, huidige hoofdstuk
  "interests": [                   // 3–5 items
    { "label": "string", "icon": "caring|romantic|playful|warm|listener" }
  ],
  "vibe_tags": ["string", ...],    // 3–6 ids uit: caring, romantic, playful, witty, chill, coffee, travel, movies, gym
  "funnel_intent_ids": ["string"], // 1–3 ids uit: chatting, friends, meaningful, casual, notsure
  "filter_tags": ["string", ...],  // 1–3 ids uit: links, active, replies, online, more
  "status_variant": "string",      // active|online|new|popular|replied|quiet
  "status_label": "string",        // korte Engelse status-tekst (bv. "Active now", "New", "Online")
  "persona_meta": {
    "personality_traits": ["string", ...],   // 4–7 NL adjectieven die haar reacties consistent sturen
    "daily_rhythm": "string",                 // 1 alinea, concrete tijden en routines
    "goals": ["string", ...],                 // 2–4 dromen of ambities
    "pet_names": ["string", ...],             // 2–4 koosnaampjes die zij zou gebruiken
    "relationship_hint": "string",            // 1 alinea over haar relatieverleden, alleen voor diepere chats
    "languages": ["nl"],                      // ISO-codes, default ["nl"]
    "voice_style": "string"                   // bv. "kort en speels", "warme zinnen, weinig emoji"
  },
  "chat_style": {
    "verbal_tics": ["string", ...],           // 3–6 NL chat-tics ("joh", "ofzo", "echt waar")
    "emoji_palette": ["string", ...],         // 2–5 favoriete emoji
    "reply_length": "short",                  // short|medium|variable
    "punctuation": "casual",                  // casual|clean
    "quirks": ["string", ...],                // 2–4 kleine eigenaardigheden
    "talks_less_about": ["string", ...]       // 0–3 onderwerpen die ze liever vermijdt
  },
  "photo_style": {
    "appearance": "string",                   // 1–2 zinnen: haar, ogen, sproetjes, glimlach — concreet
    "build": "string",                        // 1 zin: lichaamsbouw / lengte
    "style": "string",                        // 1 zin: outfit / aesthetic
    "vibe": "string",                         // 1 zin: mood/energie in foto's
    "seed": 12345,                            // willekeurig getal 1000–999999
    "attractiveness": "average",              // exact "striking" | "average" | "plain" — wordt door operator opgegeven
    "body_type": "average"                    // exact "slim" | "average" | "plus" — wordt door operator opgegeven
  }
}

Regels:
- Alleen Nederlandse steden in 'city'.
- Vibe_tags + funnel_intent_ids + filter_tags: ALLEEN ids uit de lijsten hierboven.
- Status_variant is exact één van de zes waarden.
- Reply_length is exact 'short' | 'medium' | 'variable'.
- Punctuation is exact 'casual' | 'clean'.
- Schrijf bio, looking_for, backstory, daily_rhythm, voice_style en goals in het Nederlands.
- Personality_traits zijn ook Nederlands.
- Geen placeholders zoals "TODO", "lorem ipsum" of "[vul aan]".
- Geen mannelijke namen tenzij de brief expliciet om mannen vraagt.

Aantrekkelijkheid (zeer belangrijk voor realisme):
- De operator geeft een attractiveness-niveau door (striking | average | plain).
  Pas appearance, build, style en vibe daarop aan, en zorg dat ook bio en
  persoonlijkheid bij het niveau passen. Een dating-app waarin alle vrouwen
  modellen zijn voelt als scam.
- "striking" = mooie, fotogenieke vrouw. Modeleske trekken, zelfvertrouwen.
- "average" = alledaagse Nederlandse vrouw. Niet model-mooi, niet onaantrekkelijk.
  Concreet: regelmatige trekken, sproetjes of vlekjes, gewone huid, half-up
  haar, geen styling van een visagist. Bio en stijl mogen ook gewoon zijn —
  geen "glamour fashion girl" maar "doet net of m'n studie haar uitvalt".
- "plain" = onopvallend, niet-perfect. Onregelmatige trekken, asymmetrie,
  fletse huid, kleine acne of littekens, eenvoudige kleren die niet altijd
  perfect zitten. Persoonlijkheid is vaak warmer/oprechter ter compensatie.
- VERPLICHT: zet exact dezelfde waarde door in photo_style.attractiveness.

Lichaamsbouw (body_type — onafhankelijk van attractiveness):
- "slim" = slank, slank postuur, smal frame
- "average" = gemiddeld, normaal, niet bijzonder slank of zwaar
- "plus" = curvy/dik, zachter lichaam, voller postuur, ronder gezicht
- VERPLICHT: zet exact dezelfde waarde door in photo_style.body_type.
- Pas appearance + build aan zodat ze bij body_type passen (een "plus"
  vrouw kan niet beschreven worden als "slank en sportief").

Leeftijd:
- De operator geeft een exacte leeftijd op (age = X). Gebruik die
  precies, NIET aanpassen. Pas wel bio/backstory/occupation passend
  bij die leeftijd aan (een 19-jarige is hoogstwaarschijnlijk student;
  een 38-jarige heeft waarschijnlijk al een carrière of kinderen;
  een 55-jarige werkt al lang of is al opa/oma; een 65+'er is
  waarschijnlijk gepensioneerd).
- VERPLICHT bij oudere leeftijden (45+): photo_style.appearance MOET
  expliciet leeftijdspassende fysieke kenmerken bevatten. Geen
  "rustige glimlach met sproetjes" meer — wel "rimpels rond ogen en
  mond", "grijs of zout-en-peper haar", "mature huidstructuur",
  "ouderdomsvlekjes" (afhankelijk van leeftijd). Als je dat weglaat
  produceert het diffusion-model namelijk alsnog een 25-jarige.
- Pas occupation, backstory en bio aan zodat ze geloofwaardig zijn
  voor de leeftijd. Een 60-jarige doet geen HBO meer; ze heeft een
  carrière, of werkt parttime, of is gepensioneerd.`;

const VIBE_IDS = Array.from(FUNNEL_VIBE_ID_SET);
const INTENT_IDS = Array.from(FUNNEL_LOOKING_ID_SET);
const FILTER_IDS = ["links", "active", "replies", "online", "more"] as const;
const STATUS_VARIANTS = ["active", "online", "new", "popular", "replied", "quiet"] as const;
const REPLY_LENGTHS = ["short", "medium", "variable"] as const;
const PUNCTUATIONS = ["casual", "clean"] as const;
const ICON_OPTIONS = ["caring", "romantic", "playful", "warm", "listener"] as const;

export type AttractivenessLevel = "striking" | "average" | "plain";
export type BodyTypeLevel = "slim" | "average" | "plus";

const ATTRACTIVENESS_VALUES: readonly AttractivenessLevel[] = [
  "striking",
  "average",
  "plain",
] as const;

const BODY_TYPE_VALUES: readonly BodyTypeLevel[] = [
  "slim",
  "average",
  "plus",
] as const;

export type GeneratedPersona = {
  id: string;
  display_name: string;
  age: number;
  city: string;
  occupation: string;
  bio: string;
  looking_for: string;
  backstory: string;
  interests: Array<{ label: string; icon: (typeof ICON_OPTIONS)[number] }>;
  vibe_tags: string[];
  funnel_intent_ids: string[];
  filter_tags: string[];
  status_variant: (typeof STATUS_VARIANTS)[number];
  status_label: string;
  persona_meta: {
    personality_traits: string[];
    daily_rhythm: string;
    goals: string[];
    pet_names: string[];
    relationship_hint: string;
    languages: string[];
    voice_style: string;
  };
  chat_style: {
    verbal_tics: string[];
    emoji_palette: string[];
    reply_length: (typeof REPLY_LENGTHS)[number];
    punctuation: (typeof PUNCTUATIONS)[number];
    quirks: string[];
    talks_less_about: string[];
  };
  photo_style: {
    appearance: string;
    build: string;
    style: string;
    vibe: string;
    seed: number;
    attractiveness: AttractivenessLevel;
    body_type: BodyTypeLevel;
  };
};

export type GeneratePersonaArgs = {
  brief: string;
  /** Position in batch (0-indexed), used in the variation prompt. */
  index?: number;
  /** Batch size. */
  total?: number;
  /** Already-generated ids/display_names in this session — Grok is asked to
   * pick something different. */
  exclude?: string[];
  /** Attractiveness tier for this persona. Defaults to "average" so a
   * fresh discovery feed feels realistic. */
  attractiveness?: AttractivenessLevel;
  /** Body shape — independent from attractiveness. Default "average". */
  body_type?: BodyTypeLevel;
  /** Force this exact age (e.g. operator's range narrowed to one value).
   * If set, takes precedence over the brief and Grok cannot drift. */
  forced_age?: number;
  /** Optional pre-picked diversifier set. When omitted we pick one from
   * args.index so each batch persona gets a distinct visual fingerprint
   * (hair colour, eye colour, region, etc.). Operators can also feed in
   * a manually constructed one for fully reproducible single-shot calls. */
  diversifier?: PersonaDiversifier;
};

const SLUG_RE = /^[a-z][a-z0-9_-]{2,23}$/;

function clean(s: unknown, max = 4000): string {
  if (typeof s !== "string") return "";
  return s.trim().slice(0, max);
}
function asStrArr(v: unknown, max = 12): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .slice(0, max)
    .map((x) => x.trim());
}

function pickEnum<T extends readonly string[]>(v: unknown, allowed: T, fallback: T[number]): T[number] {
  if (typeof v !== "string") return fallback;
  const t = v.trim().toLowerCase();
  return (allowed as readonly string[]).includes(t) ? (t as T[number]) : fallback;
}

function intersect(values: string[], allowed: Set<string>): string[] {
  return values.map((v) => v.toLowerCase()).filter((v) => allowed.has(v));
}

/** Coerce Grok's raw JSON into a fully-validated GeneratedPersona, applying
 * sensible fallbacks where Grok went off-script. Returns null only when
 * the most critical fields (id, display_name, age) are completely missing
 * or unrecoverable. */
function coerce(raw: unknown): GeneratedPersona | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const idCandidate = clean(r.id, 30).toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  const id = SLUG_RE.test(idCandidate) ? idCandidate : "";
  const display_name = clean(r.display_name, 30);
  const age = (() => {
    const n = Number(r.age);
    if (!Number.isFinite(n)) return NaN;
    // 18-99 — wide range so a senior persona (60+) survives the coerce
    // step. The route always overrides with the operator's forced_age
    // anyway, but the cap matters when generate-persona is used
    // standalone or when forced_age is omitted.
    return Math.max(18, Math.min(99, Math.round(n)));
  })();
  if (!id || !display_name || !Number.isFinite(age)) return null;

  const interestsRaw = Array.isArray(r.interests) ? r.interests : [];
  const interests = (interestsRaw as Array<Record<string, unknown>>)
    .filter((it) => it && typeof it === "object" && typeof it.label === "string")
    .slice(0, 6)
    .map((it) => ({
      label: clean(it.label, 32),
      icon: pickEnum(it.icon, ICON_OPTIONS, "warm"),
    }));

  const meta = (r.persona_meta && typeof r.persona_meta === "object" ? r.persona_meta : {}) as Record<
    string,
    unknown
  >;
  const cs = (r.chat_style && typeof r.chat_style === "object" ? r.chat_style : {}) as Record<
    string,
    unknown
  >;
  const ps = (r.photo_style && typeof r.photo_style === "object" ? r.photo_style : {}) as Record<
    string,
    unknown
  >;

  return {
    id,
    display_name,
    age,
    city: clean(r.city, 80) || "Amsterdam",
    occupation: clean(r.occupation, 200),
    bio: clean(r.bio, 600),
    looking_for: clean(r.looking_for, 120),
    backstory: clean(r.backstory, 4000),
    interests,
    vibe_tags: intersect(asStrArr(r.vibe_tags, 8), FUNNEL_VIBE_ID_SET),
    funnel_intent_ids: intersect(asStrArr(r.funnel_intent_ids, 4), FUNNEL_LOOKING_ID_SET),
    filter_tags: intersect(asStrArr(r.filter_tags, 5), new Set<string>(FILTER_IDS)),
    status_variant: pickEnum(r.status_variant, STATUS_VARIANTS, "active"),
    status_label: clean(r.status_label, 60) || "Active now",
    persona_meta: {
      personality_traits: asStrArr(meta.personality_traits, 8),
      daily_rhythm: clean(meta.daily_rhythm, 800),
      goals: asStrArr(meta.goals, 5),
      pet_names: asStrArr(meta.pet_names, 5),
      relationship_hint: clean(meta.relationship_hint, 600),
      languages: asStrArr(meta.languages, 4).length ? asStrArr(meta.languages, 4) : ["nl"],
      voice_style: clean(meta.voice_style, 200),
    },
    chat_style: {
      verbal_tics: asStrArr(cs.verbal_tics, 8),
      emoji_palette: asStrArr(cs.emoji_palette, 6),
      reply_length: pickEnum(cs.reply_length, REPLY_LENGTHS, "short"),
      punctuation: pickEnum(cs.punctuation, PUNCTUATIONS, "casual"),
      quirks: asStrArr(cs.quirks, 5),
      talks_less_about: asStrArr(cs.talks_less_about, 4),
    },
    photo_style: {
      appearance: clean(ps.appearance, 600),
      build: clean(ps.build, 200),
      style: clean(ps.style, 200),
      vibe: clean(ps.vibe, 200),
      seed: ((): number => {
        const n = Number(ps.seed);
        if (Number.isFinite(n) && n > 0) return Math.floor(n) >>> 0;
        return Math.floor(1000 + Math.random() * 998_999);
      })(),
      attractiveness: pickEnum(ps.attractiveness, ATTRACTIVENESS_VALUES, "average"),
      body_type: pickEnum(ps.body_type, BODY_TYPE_VALUES, "average"),
    },
  };
}

/** Strip common JSON-output mistakes (markdown fences, leading prose) before
 * JSON.parse. Returns the cleaned string. */
function stripJsonNoise(text: string): string {
  let s = text.trim();
  // Remove ```json ... ``` fences if present.
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  // Drop any prose before the first {
  const firstBrace = s.indexOf("{");
  if (firstBrace > 0) s = s.slice(firstBrace);
  // Drop any trailing commentary after the last }
  const lastBrace = s.lastIndexOf("}");
  if (lastBrace >= 0 && lastBrace < s.length - 1) s = s.slice(0, lastBrace + 1);
  return s;
}

export type GenerateResult =
  | { ok: true; persona: GeneratedPersona; rawText: string }
  | { ok: false; error: string; rawText?: string };

export async function generatePersonaFromBrief(
  args: GeneratePersonaArgs,
): Promise<GenerateResult> {
  const brief = args.brief?.trim() || "";
  if (!brief) return { ok: false, error: "Geen brief opgegeven." };

  const idx = typeof args.index === "number" ? args.index : 0;
  const total = typeof args.total === "number" ? args.total : 1;
  const excludeList = (args.exclude ?? []).slice(0, 12);
  const attractiveness: AttractivenessLevel =
    args.attractiveness && ATTRACTIVENESS_VALUES.includes(args.attractiveness)
      ? args.attractiveness
      : "average";
  const bodyType: BodyTypeLevel =
    args.body_type && BODY_TYPE_VALUES.includes(args.body_type)
      ? args.body_type
      : "average";
  const forcedAge =
    typeof args.forced_age === "number" && Number.isFinite(args.forced_age)
      ? Math.max(18, Math.min(99, Math.round(args.forced_age)))
      : null;

  // Build a diversifier — either from the caller, or freshly picked
  // using the persona's batch index as the seed. Without these
  // ingredients Grok converges on its statistical median (blond,
  // half-knot, Amsterdam, marketing student) for every persona, which
  // is exactly what the operator complained about ("ze lijken op
  // elkaar"). With them we force a distinct visual + narrative
  // fingerprint per persona.
  let diversifier =
    args.diversifier ??
    pickPersonaDiversifier({ index: idx, extraSeed: brief.length });
  // For 50+ personas, override the hair colour and add age-skin cues
  // because the default HAIR_COLORS palette is skewed to the 20-40
  // range — a 65-year-old described as "platinablond" then becomes
  // visually inconsistent with the diffusion age anchor.
  if (forcedAge !== null && forcedAge >= 50) {
    diversifier = applyAgeOverride(diversifier, forcedAge);
  }

  const userParts: string[] = [];
  userParts.push(`Brief van de operator: ${brief}`);
  userParts.push(
    `Aantrekkelijkheid (verplicht): ${attractiveness}. Stem appearance/build/style/vibe daarop af, en zet photo_style.attractiveness ook op "${attractiveness}".`,
  );
  userParts.push(
    `Lichaamsbouw (verplicht): ${bodyType}. Stem appearance + build daarop af; zet photo_style.body_type op "${bodyType}".`,
  );
  if (forcedAge !== null) {
    userParts.push(
      `Leeftijd (verplicht, exact): ${forcedAge}. Pas bio/backstory/occupation aan zodat ze passen bij deze leeftijd.`,
    );
  }
  // Diversifier always goes in — these are the concrete details that
  // keep batch personas distinct.
  userParts.push(renderDiversifierBlock(diversifier));
  if (total > 1) {
    userParts.push(
      `Dit is persona #${idx + 1} van ${total}. De diversifier-details hierboven maken haar uniek — gebruik ze ook letterlijk in appearance/style/city. Andere personas in de batch krijgen een ANDERE diversifier-set, dus geen sjabloon-output.`,
    );
  }
  if (excludeList.length > 0) {
    userParts.push(`Vermijd deze al-bestaande ids/namen: ${excludeList.join(", ")}.`);
  }
  userParts.push(
    "Output: één geldig JSON-object exact volgens schema. Geen markdown, geen uitleg eromheen.",
  );

  const messages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    { role: "user" as const, content: userParts.join("\n\n") },
  ];

  // Slightly cooler than the chat persona temperature: 0.85 keeps
  // batch personas distinct (different cities, occupations, bios) while
  // significantly reducing the rate of malformed JSON output that would
  // force us into the repair-call path. Repair retries add ~15s and
  // were the main reason Vercel hit the 30s ceiling.
  const grok = await grokResponsesComplete(messages, {
    temperature: 0.85,
    maxOutputTokens: 2048,
  });
  if (!grok.ok) {
    return { ok: false, error: `Grok-call faalde: ${grok.error}` };
  }

  const cleaned = stripJsonNoise(grok.text);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // One repair attempt — ask Grok to reformat its own output.
    const repair = await grokResponsesComplete(
      [
        {
          role: "system" as const,
          content:
            "Herstel de onderstaande tekst tot één geldig JSON-object volgens het persona-schema. Output ALLEEN JSON, niets anders.",
        },
        { role: "user" as const, content: cleaned },
      ],
      { temperature: 0.1, maxOutputTokens: 2048 },
    );
    if (!repair.ok) {
      return { ok: false, error: `JSON parse + repair faalden: ${repair.error}`, rawText: grok.text };
    }
    try {
      parsed = JSON.parse(stripJsonNoise(repair.text));
    } catch (e) {
      return {
        ok: false,
        error: `JSON parse faalde na repair: ${e instanceof Error ? e.message : String(e)}`,
        rawText: grok.text,
      };
    }
  }

  const persona = coerce(parsed);
  if (!persona) {
    return {
      ok: false,
      error: "Persona-output mist verplichte velden (id/naam/leeftijd).",
      rawText: grok.text,
    };
  }

  // Force the operator's choices, even if Grok drifted. The diffusion
  // anchors are keyed off these fields, and the API forwards them to
  // the validator — they MUST be authoritative on what the operator
  // picked, not on what Grok felt like writing.
  persona.photo_style.attractiveness = attractiveness;
  persona.photo_style.body_type = bodyType;
  if (forcedAge !== null) {
    persona.age = forcedAge;
  }

  return { ok: true, persona, rawText: grok.text };
}
