/** Onboarding funnel copy + option lists (English UI per product spec). */

export type LookingForOption = {
  id: string;
  emoji: string;
  label: string;
  description: string;
};

export const FUNNEL_LOOKING_FOR: LookingForOption[] = [
  {
    id: "chatting",
    emoji: "💬",
    label: "Just chatting",
    description: "Light banter, no pressure",
  },
  {
    id: "friends",
    emoji: "🤝",
    label: "New friends",
    description: "Meet people in your area",
  },
  {
    id: "meaningful",
    emoji: "💜",
    label: "Meaningful connection",
    description: "Slow, real conversations",
  },
  {
    id: "casual",
    emoji: "🌶️",
    label: "Something casual",
    description: "Keep it fun and easy",
  },
];

export type VibeOption = {
  id: string;
  emoji: string;
  label: string;
  /** Tailwind-ish background when selected */
  tint: string;
  selectedClass: string;
};

export const FUNNEL_VIBES: VibeOption[] = [
  {
    id: "caring",
    emoji: "💗",
    label: "Caring",
    tint: "bg-pink-100",
    selectedClass: "bg-pink-200 ring-2 ring-pink-300/80",
  },
  {
    id: "romantic",
    emoji: "💜",
    label: "Romantic",
    tint: "bg-purple-100",
    selectedClass: "bg-purple-200 ring-2 ring-purple-300/80",
  },
  {
    id: "playful",
    emoji: "🙂",
    label: "Playful",
    tint: "bg-amber-100",
    selectedClass: "bg-amber-200 ring-2 ring-amber-300/80",
  },
  {
    id: "warm",
    emoji: "👥",
    label: "Warm",
    tint: "bg-orange-100",
    selectedClass: "bg-orange-200 ring-2 ring-orange-300/80",
  },
  {
    id: "listener",
    emoji: "🎧",
    label: "Listener",
    tint: "bg-sky-100",
    selectedClass: "bg-sky-200 ring-2 ring-sky-300/80",
  },
  {
    id: "coffee",
    emoji: "☕",
    label: "Coffee",
    tint: "bg-stone-100",
    selectedClass: "bg-stone-200 ring-2 ring-stone-300/80",
  },
  {
    id: "travel",
    emoji: "✈️",
    label: "Travel",
    tint: "bg-cyan-100",
    selectedClass: "bg-cyan-200 ring-2 ring-cyan-300/80",
  },
  {
    id: "movies",
    emoji: "🎬",
    label: "Movies",
    tint: "bg-indigo-100",
    selectedClass: "bg-indigo-200 ring-2 ring-indigo-300/80",
  },
  {
    id: "gym",
    emoji: "💪",
    label: "Gym",
    tint: "bg-red-100",
    selectedClass: "bg-red-200 ring-2 ring-red-300/80",
  },
  {
    id: "reading",
    emoji: "📚",
    label: "Reading",
    tint: "bg-emerald-100",
    selectedClass: "bg-emerald-200 ring-2 ring-emerald-300/80",
  },
  {
    id: "gaming",
    emoji: "🎮",
    label: "Gaming",
    tint: "bg-violet-100",
    selectedClass: "bg-violet-200 ring-2 ring-violet-300/80",
  },
  {
    id: "art",
    emoji: "🎨",
    label: "Art",
    tint: "bg-fuchsia-100",
    selectedClass: "bg-fuchsia-200 ring-2 ring-fuchsia-300/80",
  },
  {
    id: "witty",
    emoji: "🌶️",
    label: "Witty",
    tint: "bg-rose-100",
    selectedClass: "bg-rose-200 ring-2 ring-rose-300/80",
  },
  {
    id: "chill",
    emoji: "🌿",
    label: "Chill",
    tint: "bg-lime-100",
    selectedClass: "bg-lime-200 ring-2 ring-lime-300/80",
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

export type WhisperUserLocal = {
  name: string;
  age: number;
  location: string;
  vibe: string[];
  ageMin: number;
  ageMax: number;
  lookingForId: string;
  pickedMatchId: string;
  firstMessage: string;
};

export function vibeLabel(id: string): string {
  return FUNNEL_VIBES.find((v) => v.id === id)?.label ?? id;
}

export function vibeEmoji(id: string): string {
  return FUNNEL_VIBES.find((v) => v.id === id)?.emoji ?? "✨";
}
