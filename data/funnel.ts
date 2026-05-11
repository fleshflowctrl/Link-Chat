/** Onboarding funnel copy + option lists (English UI per product spec). */

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
    label: "Just chatting",
    description: "Light banter, no pressure",
    cardBg: "bg-blue-50",
    cardBorder: "border-blue-100",
    tileBg: "bg-blue-200/70",
  },
  {
    id: "friends",
    emoji: "🤝",
    label: "New friends",
    description: "Meet people in your area",
    cardBg: "bg-yellow-50",
    cardBorder: "border-yellow-100",
    tileBg: "bg-yellow-200/70",
  },
  {
    id: "meaningful",
    emoji: "💜",
    label: "Meaningful connection",
    description: "Slow, real conversations",
    cardBg: "bg-purple-50",
    cardBorder: "border-purple-100",
    tileBg: "bg-purple-200/70",
  },
  {
    id: "casual",
    emoji: "🌶️",
    label: "Something casual",
    description: "Keep it fun and easy",
    cardBg: "bg-pink-50",
    cardBorder: "border-pink-100",
    tileBg: "bg-pink-200/70",
  },
  {
    id: "notsure",
    emoji: "🤷",
    label: "Not sure yet",
    description: "We'll show you a mix",
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
    label: "Caring",
    category: "vibes",
    selectedBg: "bg-pink-100",
    selectedRing: "ring-pink-400",
  },
  {
    id: "romantic",
    emoji: "💜",
    label: "Romantic",
    category: "vibes",
    selectedBg: "bg-purple-100",
    selectedRing: "ring-purple-400",
  },
  {
    id: "playful",
    emoji: "🙂",
    label: "Playful",
    category: "vibes",
    selectedBg: "bg-yellow-100",
    selectedRing: "ring-yellow-400",
  },
  {
    id: "witty",
    emoji: "🌶️",
    label: "Witty",
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
    label: "Coffee",
    category: "hobbies",
    selectedBg: "bg-amber-100",
    selectedRing: "ring-amber-400",
  },
  {
    id: "travel",
    emoji: "✈️",
    label: "Travel",
    category: "hobbies",
    selectedBg: "bg-sky-100",
    selectedRing: "ring-sky-400",
  },
  {
    id: "movies",
    emoji: "🎬",
    label: "Movies",
    category: "hobbies",
    selectedBg: "bg-blue-100",
    selectedRing: "ring-blue-400",
  },
  {
    id: "gym",
    emoji: "💪",
    label: "Gym",
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
  "That photo caught my eye — what were you up to when it was taken?",
  "What does a perfect slow Sunday look like for you?",
  "Coffee shop or long walk — which would you pick for a first hangout?",
  "What's something small that's been making you happy lately?",
];

const STARTER_LINE_MIN = 10;

const LOOKING_FOR_STARTERS: Record<
  FunnelLookingFor,
  readonly [string, string]
> = {
  chatting: [
    "What's been the highlight of your week, even if it was something tiny?",
    "I'm curious — what's a fun rabbit hole you've gone down on the internet lately?",
  ],
  friends: [
    "If we grabbed a coffee in your neighborhood, what's one thing you'd want to talk about first?",
    "What's your favorite low-pressure way to get to know someone new?",
  ],
  meaningful: [
    "What helps you feel genuinely heard when you're opening up to someone?",
    "What's something you're into lately that you'd love to go a little deeper on?",
  ],
  casual: [
    "What's your ideal chill night in — snacks, a show, or something else entirely?",
    "Silly but important: are you team sweet breakfast or savory breakfast?",
  ],
  notsure: [
    "What are you quietly hoping to find here — totally fine if you're still figuring it out!",
    "What's one thing you're looking forward to in the next couple of weeks?",
  ],
};

const VIBE_STARTERS: Record<string, string> = {
  caring:
    "You seem warm — what's a small kindness someone showed you recently that stuck with you?",
  romantic:
    "I'm a sucker for good stories — what's a moment from your life that still feels cinematic?",
  playful:
    "Quick game: two truths and a lie — want to drop yours and I'll guess?",
  witty:
    "What's a joke, meme, or hot take that's been living in your head rent-free lately?",
  chill:
    "How do you like to reset after a busy day — music, a walk, or full couch mode?",
  coffee:
    "Oat latte, flat white, or something else — and what's your go-to café order ritual?",
  travel:
    "What's the last place you visited that you'd go back to in a heartbeat, and why?",
  movies:
    "What movie do you put on when you need comfort food for the soul?",
  gym:
    "Morning workout or evening gym — which camp are you in, and what keeps you consistent?",
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
