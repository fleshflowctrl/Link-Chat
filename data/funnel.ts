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

export const FUNNEL_STARTER_MESSAGES: string[] = [
  "Hey 👋",
  "That photo is amazing — where was it taken?",
  "What's your perfect Sunday?",
  "Coffee or tea? It matters.",
];

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
  pickedMatchId: string;
  firstMessage: string;
  /** Set after onboarding; merged on repeat completions. */
  credits?: number;
};

export function vibeLabel(id: string): string {
  return FUNNEL_VIBES.find((v) => v.id === id)?.label ?? id;
}

export function vibeEmoji(id: string): string {
  return FUNNEL_VIBES.find((v) => v.id === id)?.emoji ?? "✨";
}
