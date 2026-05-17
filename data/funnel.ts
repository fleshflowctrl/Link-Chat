/** Onboarding funnel copy + option lists (Nederlandse UI). */

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
    id: "chatting",
    emoji: "💬",
    label: "Gewoon chatten",
    description: "Luchtig geplaat, geen druk",
    cardBg: "bg-blue-50",
    cardBorder: "border-blue-100",
    tileBg: "bg-blue-200/70",
  },
  {
    id: "friends",
    emoji: "🤝",
    label: "Nieuwe vrienden",
    description: "Ontmoet mensen bij jou in de buurt",
    cardBg: "bg-yellow-50",
    cardBorder: "border-yellow-100",
    tileBg: "bg-yellow-200/70",
  },
  {
    id: "meaningful",
    emoji: "💜",
    label: "Betekenisvolle connectie",
    description: "Langzame, echte gesprekken",
    cardBg: "bg-purple-50",
    cardBorder: "border-purple-100",
    tileBg: "bg-purple-200/70",
  },
  {
    id: "casual",
    emoji: "🌶️",
    label: "Iets casuals",
    description: "Leuk en ontspannen houden",
    cardBg: "bg-pink-50",
    cardBorder: "border-pink-100",
    tileBg: "bg-pink-200/70",
  },
  {
    id: "notsure",
    emoji: "🤷",
    label: "Nog niet zeker",
    description: "We tonen je een mix",
    cardBg: "bg-gray-50",
    cardBorder: "border-gray-200",
    tileBg: "bg-gray-200/70",
  },
];

export const FUNNEL_LOOKING_IDS: readonly FunnelLookingFor[] = FUNNEL_LOOKING_FOR.map(
  (o) => o.id,
);
export const FUNNEL_LOOKING_ID_SET = new Set<string>(FUNNEL_LOOKING_IDS);

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
    label: "Zorgzaam",
    category: "vibes",
    selectedBg: "bg-pink-100",
    selectedRing: "ring-pink-400",
  },
  {
    id: "romantic",
    emoji: "💜",
    label: "Romantisch",
    category: "vibes",
    selectedBg: "bg-purple-100",
    selectedRing: "ring-purple-400",
  },
  {
    id: "playful",
    emoji: "🙂",
    label: "Speels",
    category: "vibes",
    selectedBg: "bg-yellow-100",
    selectedRing: "ring-yellow-400",
  },
  {
    id: "witty",
    emoji: "🌶️",
    label: "Geestig",
    category: "vibes",
    selectedBg: "bg-red-100",
    selectedRing: "ring-red-400",
  },
  {
    id: "chill",
    emoji: "🌿",
    label: "Chill",
    category: "vibes",
    selectedBg: "bg-green-100",
    selectedRing: "ring-green-400",
  },
  {
    id: "coffee",
    emoji: "☕",
    label: "Koffie",
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
    label: "Films",
    category: "hobbies",
    selectedBg: "bg-blue-100",
    selectedRing: "ring-blue-400",
  },
  {
    id: "gym",
    emoji: "💪",
    label: "Sport",
    category: "hobbies",
    selectedBg: "bg-orange-100",
    selectedRing: "ring-orange-400",
  },
];

/** Canonical ids for funnel step 3 + `chat_profiles.vibe_tags` + overlap matching. */
export const FUNNEL_VIBE_IDS: readonly string[] = FUNNEL_VIBES.map((v) => v.id);
export const FUNNEL_VIBE_ID_SET = new Set<string>(FUNNEL_VIBE_IDS);

/** Generic fallbacks (each ≥10 chars for first-message step validation). */
export const FUNNEL_STARTER_MESSAGES: string[] = [
  "Hé! Je foto deed me glimlachen — wat is het verhaal erachter?",
  "Hoi :) wat is iets kleins dat deze week goed ging?",
  "Willekeurige vraag: ben jij meer zonsopgang- of zonsondergang-energie?",
  "Hé — als we iets drinken, waar zouden we het als eerste over hebben?",
];

const STARTER_LINE_MIN = 10;

const LOOKING_FOR_STARTERS: Record<
  FunnelLookingFor,
  readonly [string, string]
> = {
  chatting: [
    "Hé! In welke stemming zit je vandaag voor een chat — gek, diep of een mix?",
    "Hoi :) wat is iets kleins waar je de laatste tijd om moest lachen?",
  ],
  friends: [
    "Hé! Ik zou je graag leren kennen — wat vulde je avonden de laatste tijd?",
    "Hoi — waar ben je nu mee bezig dat je met iemand nieuw zou willen delen?",
  ],
  meaningful: [
    "Hé :) ik hou van echte gesprekken — waar ben je de laatste tijd mee bezig dat je zou willen delen?",
    "Hoi! Wat speelt er bij jou de laatste tijd, goed of gek?",
  ],
  casual: [
    "Hé! Wat is voor jou een leuke ontspannen date?",
    "Hoi — belangrijke eerste vraag: beste snack voor een luie avond?",
  ],
  notsure: [
    "Hé! Wat bracht je hier — nog uitzoeken is helemaal oké trouwens.",
    "Hoi :) wat zou chatten met iemand nieuw voor jou de moeite waard maken?",
  ],
};

const VIBE_STARTERS: Record<string, string> = {
  caring:
    "Hé — je straalt lieve energie uit. Hoe is je dag tot nu toe, eerlijk?",
  romantic:
    "Hoi :) welke romantische cliché vind je stiekem leuk?",
  playful:
    "Oké ik moet dit weten: twee waarheden en een leugen — jij begint?",
  witty:
    "Geef me een mini hot take — iets waar je te hard voor pleit?",
  chill:
    "Hé! Meer wandelen-met-muziek chill of dekentje-en-serie chill?",
  coffee:
    "Hé — wat is je koffiebestelling? Ik moet weten waar we staan.",
  travel:
    "Hoi! Laatste reis die je leuk vond, of een droomreis als je tussen reizen zit?",
  movies:
    "Hé — comfortfilm die je opzet als je even moet resetten?",
  gym:
    "Hoi! Ochtendgym of na het werk — en hou je ervan of doe je het gewoon?",
};

/**
 * Four tappable first-message suggestions for funnel step 7, ordered from
 * “what brings you here?” then selected vibes, then generic fallbacks.
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

export const FUNNEL_SESSION_KEY = "whisper_funnel_session";
export const ONBOARDED_KEY = "whisper_onboarded";
export const WHISPER_USER_KEY = "whisper_user";

/** Funnel Step 4 — age window (slider) or “open to any age”. */
export type FunnelAgeRange = {
  min: number;
  max: number;
  anyAge: boolean;
};

/** Funnel Step 5 — profile basics (conversational form + optional local photo preview). */
export type FunnelBasics = {
  name: string;
  age: number | null;
  location: string;
  photo: string | null;
};

/** Funnel Step 6 — chosen first-contact profile from the grid. */
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
