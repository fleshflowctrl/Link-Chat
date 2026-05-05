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
  "Betekenisvolle connectie",
  "Iets casuals",
  "Nieuwe vrienden",
  "Alleen chatten",
  "Nog niet zeker",
] as const;

export const PRONOUN_OPTIONS: PronounsValue[] = [
  "she/her",
  "he/him",
  "they/them",
  "custom",
];

export const INTEREST_LIBRARY: { category: string; items: string[] }[] = [
  {
    category: "Sfeer",
    items: [
      "Zorgzaam",
      "Romantisch",
      "Speels",
      "Avontuurlijk",
      "Chill",
      "Scherpzinnig",
      "Nieuwsgierig",
    ],
  },
  {
    category: "Hobby’s",
    items: [
      "Koffie",
      "Reizen",
      "Muziek",
      "Films",
      "Sportschool",
      "Koken",
      "Lezen",
      "Gamen",
      "Kunst",
    ],
  },
  {
    category: "Manier van contact",
    items: [
      "Goede luisteraar",
      "Warm gezelschap",
      "Diepe gesprekken",
      "Luchtige humor",
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
    lastUpdatedLabel: "Vul je profiel aan",
  };
}

export function createInitialEditable(): EditProfileState {
  return emptyEditProfileState();
}

/** @deprecated Use `emptyEditProfileState` — kept for call-site clarity. */
export function createDefaultEditableForNewUser(): EditProfileState {
  return emptyEditProfileState();
}
