export type PronounsValue = "she/her" | "he/him" | "they/them" | "custom";

export type GalleryPhoto = { id: string; url: string };

export type EditProfilePreferences = {
  showDistance: boolean;
  showOnlineStatus: boolean;
  allowNewChatRequests: boolean;
  pushNotifications: boolean;
};

export type EditProfileState = {
  firstName: string;
  /** `null` = user has not set age yet (stored as NULL in Supabase). */
  age: number | null;
  location: string;
  pronouns: PronounsValue;
  customPronouns: string;
  bio: string;
  lookingFor: string;
  interests: string[];
  mainPhotoUrl: string;
  gallery: GalleryPhoto[];
  preferences: EditProfilePreferences;
  lastUpdatedLabel: string;
};

export const LOOKING_FOR_OPTIONS = [
  "Meaningful connection",
  "Something casual",
  "New friends",
  "Just chatting",
  "Not sure yet",
] as const;

export const PRONOUN_OPTIONS: PronounsValue[] = [
  "she/her",
  "he/him",
  "they/them",
  "custom",
];

export const INTEREST_LIBRARY: { category: string; items: string[] }[] = [
  {
    category: "Vibes",
    items: [
      "Caring",
      "Romantic",
      "Playful",
      "Adventurous",
      "Chill",
      "Witty",
      "Curious",
    ],
  },
  {
    category: "Hobbies",
    items: [
      "Coffee",
      "Travel",
      "Music",
      "Movies",
      "Gym",
      "Cooking",
      "Reading",
      "Gaming",
      "Art",
    ],
  },
  {
    category: "Connection style",
    items: [
      "Good listener",
      "Warm company",
      "Deep talks",
      "Light banter",
    ],
  },
];

/** Blank profile — no stock photos or demo copy (new signups, dev bypass, offline). */
export function emptyEditProfileState(): EditProfileState {
  return {
    firstName: "",
    age: null,
    location: "",
    pronouns: "they/them",
    customPronouns: "",
    bio: "",
    lookingFor: "",
    interests: [],
    mainPhotoUrl: "",
    gallery: [],
    preferences: {
      showDistance: true,
      showOnlineStatus: true,
      allowNewChatRequests: true,
      pushNotifications: true,
    },
    lastUpdatedLabel: "Complete your profile",
  };
}

export function createInitialEditable(): EditProfileState {
  return emptyEditProfileState();
}

/** @deprecated Use `emptyEditProfileState` — kept for call-site clarity. */
export function createDefaultEditableForNewUser(): EditProfileState {
  return emptyEditProfileState();
}
