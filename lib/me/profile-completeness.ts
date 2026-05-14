import type { EditProfileState } from "@/data/me-edit";

export type CompletenessField =
  | "photo"
  | "name"
  | "age"
  | "location"
  | "bio"
  | "interests"
  | "gallery";

export type CompletenessFieldMeta = {
  key: CompletenessField;
  label: string;
  /** Short user-facing nudge shown on the checklist. */
  cta: string;
  /** Emoji shown on the row. */
  emoji: string;
  /** Credits awarded the first time this milestone is satisfied. */
  reward: number;
  /** Anchor query used by /me/edit to scroll/focus the right block. */
  focus: string;
};

export const COMPLETENESS_FIELDS: CompletenessFieldMeta[] = [
  {
    key: "photo",
    label: "Profielfoto",
    cta: "Voeg een profielfoto toe",
    emoji: "📸",
    reward: 10,
    focus: "photo",
  },
  {
    key: "name",
    label: "Naam",
    cta: "Vul je naam in",
    emoji: "🪪",
    reward: 0,
    focus: "name",
  },
  {
    key: "age",
    label: "Leeftijd",
    cta: "Vul je leeftijd in",
    emoji: "🎂",
    reward: 0,
    focus: "age",
  },
  {
    key: "location",
    label: "Locatie",
    cta: "Voeg je locatie toe",
    emoji: "📍",
    reward: 5,
    focus: "location",
  },
  {
    key: "bio",
    label: "Korte bio",
    cta: "Schrijf een korte bio",
    emoji: "✍️",
    reward: 10,
    focus: "bio",
  },
  {
    key: "interests",
    label: "Interesses",
    cta: "Kies minimaal 3 interesses",
    emoji: "🏷️",
    reward: 10,
    focus: "interests",
  },
  {
    key: "gallery",
    label: "Meer foto's",
    cta: "Voeg minstens 3 foto's toe",
    emoji: "🖼",
    reward: 15,
    focus: "gallery",
  },
];

export const TOTAL_PROFILE_REWARD_CREDITS = COMPLETENESS_FIELDS.reduce(
  (sum, f) => sum + f.reward,
  0,
);

// Just "filled in something" counts — the reward is meant to nudge users
// to write *anything*, so don't gate it behind an arbitrary length.
const MIN_BIO_CHARS = 1;
const MIN_INTERESTS = 3;
const MIN_GALLERY = 3;

/**
 * Returns true if the field is "filled in well enough to count" — used both
 * for the visible progress ring and for server-side reward validation.
 *
 * Keep this function pure / state-derived so the same logic runs on the
 * client (instant UI) and on the API route (authoritative reward).
 */
export function isFieldComplete(
  state: Partial<EditProfileState>,
  key: CompletenessField,
): boolean {
  switch (key) {
    case "photo":
      return Boolean(state.mainPhotoUrl?.trim());
    case "name":
      return Boolean(state.firstName?.trim());
    case "age":
      return typeof state.age === "number" && state.age >= 18;
    case "location":
      return Boolean(state.location?.trim());
    case "bio":
      return (state.bio ?? "").trim().length >= MIN_BIO_CHARS;
    case "interests":
      return (state.interests ?? []).length >= MIN_INTERESTS;
    case "gallery":
      return (state.gallery ?? []).length >= MIN_GALLERY;
  }
}

export type CompletenessReport = {
  fields: Record<CompletenessField, boolean>;
  completedCount: number;
  totalCount: number;
  /** 0–100 integer. */
  percent: number;
  /** Up to N missing fields, ordered by priority. Caller decides how many to render. */
  nextSteps: CompletenessFieldMeta[];
};

export function getProfileCompleteness(
  state: Partial<EditProfileState>,
): CompletenessReport {
  const fields = {} as Record<CompletenessField, boolean>;
  for (const meta of COMPLETENESS_FIELDS) {
    fields[meta.key] = isFieldComplete(state, meta.key);
  }
  const completedCount = COMPLETENESS_FIELDS.filter(
    (m) => fields[m.key],
  ).length;
  const totalCount = COMPLETENESS_FIELDS.length;
  const percent = Math.round((completedCount / totalCount) * 100);
  const nextSteps = COMPLETENESS_FIELDS.filter((m) => !fields[m.key]);

  return { fields, completedCount, totalCount, percent, nextSteps };
}

/**
 * Hard requirement: a profile photo must be set before the user starts a
 * brand-new conversation. Used by the chat composer to gate `sendText`.
 */
export function hasProfilePhoto(
  state: Pick<EditProfileState, "mainPhotoUrl">,
): boolean {
  return Boolean(state.mainPhotoUrl?.trim());
}

/**
 * The "minimum viable profile" required to be shown around the rest of the
 * app — photo, name, age. Used on /discover to gate the social-proof rail
 * (we only show "Nieuw op whisper" once the user themselves looks like a
 * real profile to others).
 */
export function hasProfileBasics(
  state: Pick<EditProfileState, "mainPhotoUrl" | "firstName" | "age">,
): boolean {
  return (
    isFieldComplete(state, "photo") &&
    isFieldComplete(state, "name") &&
    isFieldComplete(state, "age")
  );
}
