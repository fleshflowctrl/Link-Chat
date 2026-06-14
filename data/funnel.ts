/** Onboarding funnel copy + option lists (Nederlandse UI, gescheiden professionals). */

export type FunnelLookingFor =
  | "chatting"
  | "friends"
  | "meaningful"
  | "casual"
  | "notsure";

export type LookingForOption = {
  id: FunnelLookingFor;
  emoji: string;
  label: string;
  description: string;
  cardBg: string;
  cardBorder: string;
  tileBg: string;
};

export const FUNNEL_LOOKING_FOR: LookingForOption[] = [
  {
    id: "casual",
    emoji: "✨",
    label: "Opnieuw verleid worden",
    description: "Chemie en flirt na een nieuwe start",
    cardBg: "bg-pink-50",
    cardBorder: "border-pink-100",
    tileBg: "bg-pink-200/70",
  },
  {
    id: "chatting",
    emoji: "🤫",
    label: "Discreet contact",
    description: "Privé gesprekken · jouw tempo",
    cardBg: "bg-blue-50",
    cardBorder: "border-blue-100",
    tileBg: "bg-blue-200/70",
  },
  {
    id: "friends",
    emoji: "🍷",
    label: "Gezelschap met klasse",
    description: "Iemand op jouw niveau",
    cardBg: "bg-yellow-50",
    cardBorder: "border-yellow-100",
    tileBg: "bg-yellow-200/70",
  },
  {
    id: "meaningful",
    emoji: "💼",
    label: "Iets échts, zonder haast",
    description: "Geen drama · wel diepte",
    cardBg: "bg-purple-50",
    cardBorder: "border-purple-100",
    tileBg: "bg-purple-200/70",
  },
  {
    id: "notsure",
    emoji: "👀",
    label: "Ik verken het rustig",
    description: "Geen verplichtingen",
    cardBg: "bg-gray-50",
    cardBorder: "border-gray-200",
    tileBg: "bg-gray-200/70",
  },
];

export const FUNNEL_LOOKING_IDS: readonly FunnelLookingFor[] = FUNNEL_LOOKING_FOR.map(
  (o) => o.id,
);
export const FUNNEL_LOOKING_ID_SET = new Set<string>(FUNNEL_LOOKING_IDS);

export function funnelLookingForLabel(id: FunnelLookingFor | null): string {
  if (!id) return "";
  return FUNNEL_LOOKING_FOR.find((o) => o.id === id)?.label ?? id;
}

export type VibeCategory = "vibes" | "hobbies" | "style";

export type VibeOption = {
  id: string;
  emoji: string;
  label: string;
  category: VibeCategory;
  /** Selected tile background (Tailwind). */
  selectedBg: string;
  /** Ring color only — combined with `ring-2` in UI. */
  selectedRing: string;
};

export const FUNNEL_VIBES: VibeOption[] = [
  {
    id: "caring",
    emoji: "💗",
    label: "Warm & attent",
    category: "vibes",
    selectedBg: "bg-pink-100",
    selectedRing: "ring-pink-400",
  },
  {
    id: "romantic",
    emoji: "🥂",
    label: "Verfijnd & attent",
    category: "vibes",
    selectedBg: "bg-purple-100",
    selectedRing: "ring-purple-400",
  },
  {
    id: "playful",
    emoji: "😏",
    label: "Ondeugend & zelfverzekerd",
    category: "vibes",
    selectedBg: "bg-yellow-100",
    selectedRing: "ring-yellow-400",
  },
  {
    id: "witty",
    emoji: "✨",
    label: "Scherpe humor",
    category: "vibes",
    selectedBg: "bg-red-100",
    selectedRing: "ring-red-400",
  },
  {
    id: "chill",
    emoji: "🌿",
    label: "Rustig, geen haast",
    category: "vibes",
    selectedBg: "bg-green-100",
    selectedRing: "ring-green-400",
  },
  {
    id: "coffee",
    emoji: "☕",
    label: "Koffie & gesprek",
    category: "hobbies",
    selectedBg: "bg-amber-100",
    selectedRing: "ring-amber-400",
  },
  {
    id: "travel",
    emoji: "✈️",
    label: "Reizen",
    category: "hobbies",
    selectedBg: "bg-sky-100",
    selectedRing: "ring-sky-400",
  },
  {
    id: "movies",
    emoji: "🎬",
    label: "Films & series",
    category: "hobbies",
    selectedBg: "bg-blue-100",
    selectedRing: "ring-blue-400",
  },
  {
    id: "gym",
    emoji: "💪",
    label: "Actief",
    category: "hobbies",
    selectedBg: "bg-orange-100",
    selectedRing: "ring-orange-400",
  },
];

/** Vibe tiles shown in onboarding (max 3 picks). */
export const FUNNEL_ATTRACTION_VIBES: VibeOption[] = FUNNEL_VIBES.filter(
  (v) => v.category === "vibes",
);

/** Canonical ids for funnel + `chat_profiles.vibe_tags` + overlap matching. */
export const FUNNEL_VIBE_IDS: readonly string[] = FUNNEL_VIBES.map((v) => v.id);
export const FUNNEL_VIBE_ID_SET = new Set<string>(FUNNEL_VIBE_IDS);

export const FUNNEL_MAX_VIBE_PICKS = 3;

/** Default age window for women shown to 50+ men. */
export const FUNNEL_DEFAULT_AGE_RANGE: FunnelAgeRange = {
  min: 45,
  max: 60,
  anyAge: false,
};

/** Generic fallbacks (each ≥10 chars for first-message step validation). */
export const FUNNEL_STARTER_MESSAGES: string[] = [
  "Hé — nieuw hoofdstuk, zelfde succes. Wat mis je soms in je avonden?",
  "Fijn contact zonder haast — waar ben jij nu naar op zoek?",
  "Eerlijk: jij lijkt iemand met klasse. Zin in een discreet gesprek?",
  "Wat zou voor jou een perfecte, rustige eerste ontmoeting zijn?",
];

const STARTER_LINE_MIN = 10;

const LOOKING_FOR_STARTERS: Record<
  FunnelLookingFor,
  readonly [string, string]
> = {
  casual: [
    "Hé! Na een scheiding zoek ik weer die vonk — wat trekt jou aan in een gesprek?",
    "Hoi — discreet flirten op jouw tempo: waar heb je zin in?",
  ],
  chatting: [
    "Hé! Discreet chatten past bij mijn leven — wat is jouw ideale avond?",
    "Hoi — wat zou je willen dat iemand als eerste tegen je zegt?",
  ],
  friends: [
    "Hé! Gezelschap op niveau, met een vleugje spanning — wat mis jij soms?",
    "Hoi — wat doe je het liefst na een drukke week?",
  ],
  meaningful: [
    "Hé — echte gesprekken, zonder haast of drama. Wat speelt er bij jou?",
    "Hoi! Wat zou voor jou een goede eerste indruk zijn?",
  ],
  notsure: [
    "Hé! Ik verken het rustig — wat zou chatten hier voor jou de moeite waard maken?",
    "Hoi — wat sprak je aan op mijn profiel?",
  ],
};

const VIBE_STARTERS: Record<string, string> = {
  caring:
    "Hé — je lijkt warm en attent. Hoe ziet jouw ideale rustige avond eruit?",
  romantic:
    "Hoi — waar word jij blij van: aandacht, complimenten, of iets onverwachts?",
  playful:
    "Oké, eerlijke vraag: ben jij meer plagen of meer verleiden?",
  witty:
    "Geef me één mening waar je vast in gelooft — ik ben benieuwd.",
  chill:
    "Hé! Meer rustig wandelen of dekentje op de bank — wat past bij jou?",
  coffee:
    "Hé — koffie, wijn of iets sterks op een eerste ontmoeting?",
  travel:
    "Hoi! Laatste uitje dat je leuk vond — stad, strand of gewoon thuis?",
  movies:
    "Hé — welke serie of film zou je met iemand willen delen?",
  gym:
    "Hoi! Blijf je graag actief — of is ontspannen belangrijker?",
};

/**
 * Four tappable first-message suggestions for funnel step 7, ordered from
 * intent then selected vibes, then generic fallbacks.
 */
export function getPersonalizedFirstMessageStarters(
  lookingFor: FunnelLookingFor | null,
  vibeIds: string[],
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (raw: string) => {
    const t = raw.trim();
    if (t.length < STARTER_LINE_MIN || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };

  if (lookingFor && LOOKING_FOR_STARTERS[lookingFor]) {
    for (const line of LOOKING_FOR_STARTERS[lookingFor]) {
      push(line);
      if (out.length >= 4) return out.slice(0, 4);
    }
  }

  for (const id of vibeIds) {
    const line = VIBE_STARTERS[id];
    if (line) push(line);
    if (out.length >= 4) return out.slice(0, 4);
  }

  for (const line of FUNNEL_STARTER_MESSAGES) {
    push(line);
    if (out.length >= 4) break;
  }

  return out.slice(0, 4);
}

/** Insert peer first name into generic openers when possible. */
export function personalizeStarterLine(line: string, peerName: string): string {
  const name = peerName.trim();
  if (!name) return line;
  if (line.startsWith("Hé!")) return line.replace("Hé!", `Hé ${name}!`);
  if (line.startsWith("Hé —")) return line.replace("Hé —", `Hé ${name} —`);
  if (line.startsWith("Hoi")) return line.replace(/^Hoi/, `Hoi ${name}`);
  if (line.startsWith("Oké")) return `Hé ${name} — ${line}`;
  if (line.startsWith("Eerlijk")) return `Hé ${name} — ${line}`;
  return line;
}

export const FUNNEL_SESSION_KEY = "whisper_funnel_session";
export const ONBOARDED_KEY = "whisper_onboarded";
export const WHISPER_USER_KEY = "whisper_user";

/** Funnel — age window for women (slider/presets) or “open to any age”. */
export type FunnelAgeRange = {
  min: number;
  max: number;
  anyAge: boolean;
};

/** Funnel — user's own age bucket id (e.g. `50-54`, `85+`). */
export type FunnelMyAgeBucket = string;

export type FunnelMyAgeBucketOption = {
  id: FunnelMyAgeBucket;
  label: string;
  /** Representative age stored in `basics.age`. */
  age: number;
};

/** Max 8 age buckets (35–75+) for funnel step 3. */
export const FUNNEL_MY_AGE_BUCKETS: FunnelMyAgeBucketOption[] = [
  { id: "35-44", label: "35 – 44", age: 40 },
  { id: "45-49", label: "45 – 49", age: 47 },
  { id: "50-54", label: "50 – 54", age: 52 },
  { id: "55-59", label: "55 – 59", age: 57 },
  { id: "60-64", label: "60 – 64", age: 62 },
  { id: "65-69", label: "65 – 69", age: 67 },
  { id: "70-74", label: "70 – 74", age: 72 },
  { id: "75+", label: "75+", age: 78 },
];

export type FunnelWomanTypeId =
  | "younger_playful"
  | "mature_warm"
  | "experienced_confident"
  | "open_any";

export type FunnelWomanTypeOption = {
  id: FunnelWomanTypeId;
  emoji: string;
  label: string;
  description: string;
  ageRange: FunnelAgeRange;
  cardBg: string;
  cardBorder: string;
  tileBg: string;
};

/** Step 4 — archetype pick; maps to `ageRange` for matching (no raw ages in UI). */
export const FUNNEL_WOMAN_TYPE_OPTIONS: FunnelWomanTypeOption[] = [
  {
    id: "younger_playful",
    emoji: "✨",
    label: "Jonger & speels",
    description: "Energiek, uitdagend, fris",
    ageRange: { min: 35, max: 50, anyAge: false },
    cardBg: "bg-pink-50",
    cardBorder: "border-pink-100",
    tileBg: "bg-pink-200/70",
  },
  {
    id: "mature_warm",
    emoji: "💗",
    label: "Volwassen & warm",
    description: "Rustig, attent — het populairste type",
    ageRange: { min: 45, max: 60, anyAge: false },
    cardBg: "bg-rose-50",
    cardBorder: "border-rose-100",
    tileBg: "bg-rose-200/70",
  },
  {
    id: "experienced_confident",
    emoji: "🔥",
    label: "Ervaren & zelfverzekerd",
    description: "Rijp, direct, weet wat ze wil",
    ageRange: { min: 50, max: 65, anyAge: false },
    cardBg: "bg-amber-50",
    cardBorder: "border-amber-100",
    tileBg: "bg-amber-200/70",
  },
  {
    id: "open_any",
    emoji: "👀",
    label: "Alles mag",
    description: "Brede mix — verrass me",
    ageRange: { min: 40, max: 70, anyAge: true },
    cardBg: "bg-purple-50",
    cardBorder: "border-purple-100",
    tileBg: "bg-purple-200/70",
  },
];

export function funnelWomanTypeAgeRange(id: FunnelWomanTypeId): FunnelAgeRange {
  const opt = FUNNEL_WOMAN_TYPE_OPTIONS.find((o) => o.id === id);
  return opt?.ageRange ?? FUNNEL_DEFAULT_AGE_RANGE;
}

export function ageRangeMatchesWomanType(
  range: FunnelAgeRange,
  id: FunnelWomanTypeId,
): boolean {
  const target = funnelWomanTypeAgeRange(id);
  return (
    range.anyAge === target.anyAge &&
    range.min === target.min &&
    range.max === target.max
  );
}

/** Funnel — profile basics (conversational form + optional local photo preview). */
export type FunnelBasics = {
  name: string;
  age: number | null;
  location: string;
  photo: string | null;
};

/** Funnel — chosen first-contact profile from the grid. */
export type FunnelFirstContact = {
  profileId: string | null;
};

export type WhisperUserLocal = {
  name: string;
  age: number;
  location: string;
  /** Local object URL or remote URL from onboarding photo picker; optional for legacy saves. */
  photo?: string | null;
  vibe: string[];
  ageRange: FunnelAgeRange;
  lookingFor: FunnelLookingFor;
  /** Present when the user completed the “first link” path; omitted if they skipped step 6–7. */
  pickedMatchId?: string | null;
  firstMessage?: string;
  /** Set after onboarding; merged on repeat completions. */
  credits?: number;
};

export function vibeLabel(id: string): string {
  return FUNNEL_VIBES.find((v) => v.id === id)?.label ?? id;
}

export function vibeEmoji(id: string): string {
  return FUNNEL_VIBES.find((v) => v.id === id)?.emoji ?? "✨";
}
