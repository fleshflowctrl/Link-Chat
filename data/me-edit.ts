import { meProfile } from "@/data/me";

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
  age: number;
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

const unsplash = (id: string, w = 600) =>
  `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`;

function gid() {
  return `g-${Math.random().toString(36).slice(2, 10)}`;
}

export function createInitialEditable(): EditProfileState {
  const main = meProfile.avatarUrl;
  const galleryUrls = [
    unsplash("photo-1494790108377-be9c29b29330"),
    unsplash("photo-1438761681033-6461ffad8d80"),
    unsplash("photo-1544005313-94ddf0286df2"),
    unsplash("photo-1507003211169-0a1dd7228f2d"),
  ];
  return {
    firstName: meProfile.firstName,
    age: meProfile.age,
    location: meProfile.location,
    pronouns: "she/her",
    customPronouns: "",
    bio: `${meProfile.bioLine1}\n${meProfile.bioLine2}`,
    lookingFor: "Meaningful connection",
    interests: [
      "Caring",
      "Romantic",
      "Playful",
      "Warm company",
      "Good listener",
    ],
    mainPhotoUrl: main,
    gallery: galleryUrls.map((url) => ({ id: gid(), url })),
    preferences: {
      showDistance: true,
      showOnlineStatus: true,
      allowNewChatRequests: true,
      pushNotifications: true,
    },
    lastUpdatedLabel: "Last updated 2 days ago",
  };
}

/** Empty signed-in profile before the user saves anything (DB row may still exist from signup trigger). */
export function createDefaultEditableForNewUser(): EditProfileState {
  return {
    firstName: "",
    age: 25,
    location: "",
    pronouns: "they/them",
    customPronouns: "",
    bio: "",
    lookingFor: LOOKING_FOR_OPTIONS[0],
    interests: [],
    mainPhotoUrl:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=720&q=80&auto=format&fit=crop",
    gallery: [],
    preferences: {
      showDistance: true,
      showOnlineStatus: true,
      allowNewChatRequests: true,
      pushNotifications: true,
    },
    lastUpdatedLabel: "Not saved yet",
  };
}
