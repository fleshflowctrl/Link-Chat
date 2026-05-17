export type ProfileStatusVariant =
  | "active"
  | "replied"
  | "new"
  | "popular"
  | "quiet"
  | "online";

export type ProfileInterestIcon =
  | "caring"
  | "romantic"
  | "playful"
  | "warm"
  | "listener";

export interface ProfileInterest {
  label: string;
  icon: ProfileInterestIcon;
}

export interface Profile {
  id: string;
  name: string;
  age: number;
  /** Hero image for cards & previews (Unsplash). */
  photo: string;
  /** Shown on cards and profile hero (e.g. Amsterdam). */
  city: string;
  status: {
    variant: ProfileStatusVariant;
    label: string;
  };
  /** Shown on home cards (line-clamped) and profile detail. */
  bio: string;
  /** Gallery photos — index 0 is the hero; remaining are extra shots in the strip. */
  gallery: string[];
  interests: ProfileInterest[];
  /** Funnel / onboarding vibe ids — overlap with user picks drives match %. */
  vibe: string[];
  /** Funnel step-2 "looking for" ids from catalog — overlap boosts Step 6 match %. */
  funnelIntentIds?: string[];
  /** km — funnel Step 6 card subtitle. */
  distanceKm: number;
  /** Two glyphs for card footer (fallback when shared-vibe emojis are fewer than 2). */
  topEmojis: [string, string];
  lookingFor: string;
  lastActive: string;
  isVerified: boolean;
}

const u = (id: string, w = 800) =>
  `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`;

/** Extra female portrait IDs used as additional gallery shots across profiles. */
const EXTRA: Record<string, string[]> = {
  maya: [
    u("photo-1508214751196-bcfd4ca60f91", 1200),
    u("photo-1542596768-5d1d21f1cf98", 1200),
    u("photo-1488716820095-cbe80883c496", 1200),
    u("photo-1502685104226-ee32379fefbe", 1200),
  ],
  femke: [
    u("photo-1517841905240-472988babdf9", 1200),
    u("photo-1531746020798-e6953c6e8e04", 1200),
    u("photo-1544005313-94ddf0286df2", 1200),
  ],
  tara: [
    u("photo-1488716820095-cbe80883c496", 1200),
    u("photo-1508214751196-bcfd4ca60f91", 1200),
    u("photo-1542596768-5d1d21f1cf98", 1200),
    u("photo-1502685104226-ee32379fefbe", 1200),
  ],
  olivia: [
    u("photo-1494790108377-be9c29b29330", 1200),
    u("photo-1531746020798-e6953c6e8e04", 1200),
    u("photo-1488716820095-cbe80883c496", 1200),
  ],
  victoria: [
    u("photo-1542596768-5d1d21f1cf98", 1200),
    u("photo-1502685104226-ee32379fefbe", 1200),
    u("photo-1508214751196-bcfd4ca60f91", 1200),
    u("photo-1488716820095-cbe80883c496", 1200),
  ],
  clara: [
    u("photo-1494790108377-be9c29b29330", 1200),
    u("photo-1438761681033-6461ffad8d80", 1200),
    u("photo-1531746020798-e6953c6e8e04", 1200),
  ],
};

function newHereProfiles(): Profile[] {
  const extras = [
    u("photo-1542596768-5d1d21f1cf98", 1200),
    u("photo-1508214751196-bcfd4ca60f91", 1200),
    u("photo-1488716820095-cbe80883c496", 1200),
  ];
  const row = (
    id: string,
    name: string,
    photoId: string,
    city: string,
    distanceKm: number,
    topEmojis: [string, string],
  ): Profile => ({
    id,
    name,
    age: 25,
    photo: u(photoId),
    city,
    status: { variant: "new", label: "Nieuw" },
    isVerified: false,
    lastActive: "Zojuist",
    lookingFor: "Leuke gesprekken",
    bio: `${name} is net lid geworden van StiekemSamen.`,
    gallery: [u(photoId, 1200), ...extras],
    interests: [
      { label: "Nieuw hier", icon: "listener" },
      { label: "Vriendelijk", icon: "warm" },
    ],
    vibe: ["warm", "listener", "playful", "chill"],
    distanceKm,
    topEmojis,
  });
  return [
    row("sophie", "Sophie", "photo-1544005313-94ddf0286df2", "Haarlem", 2.1, ["☕", "🙂"]),
    row("lena", "Lena", "photo-1494790108377-be9c29b29330", "Maastricht", 1.8, ["💜", "☕"]),
    row("mia", "Mia", "photo-1534528741775-53994a69daeb", "Leiden", 3.2, ["✈️", "🎬"]),
    row("ava", "Ava", "photo-1438761681033-6461ffad8d80", "Zwolle", 2.4, ["🌿", "☕"]),
    row("zoe", "Zoe", "photo-1529626455594-4ff0802cfb7e", "Amersfoort", 1.5, ["🙂", "💗"]),
    row("iris", "Iris", "photo-1531746020798-e6953c6e8e04", "Delft", 2.9, ["🎧", "📚"]),
    row("nora", "Nora", "photo-1517841905240-472988babdf9", "Alkmaar", 3.6, ["💗", "🌿"]),
  ];
}

/** Seed profiles. */
export const profiles: Profile[] = [
  {
    id: "maya",
    name: "Maya",
    age: 26,
    photo: u("photo-1534528741775-53994a69daeb"),
    city: "Amsterdam",
    status: { variant: "active", label: "Nu actief" },
    isVerified: true,
    lastActive: "Vandaag actief",
    lookingFor: "Betekenisvolle connectie",
    bio: "Houd van goede koffie, roadtrips en echte gesprekken. Zacht & warm — geen spelletjes. Laten we kijken waar het schip strandt 🌿",
    gallery: [u("photo-1534528741775-53994a69daeb", 1200), ...EXTRA.maya],
    interests: [
      { label: "Zorgzaam", icon: "caring" },
      { label: "Romantisch", icon: "romantic" },
      { label: "Speels", icon: "playful" },
      { label: "Warm gezelschap", icon: "warm" },
      { label: "Goede luisteraar", icon: "listener" },
    ],
    vibe: ["caring", "romantic", "playful", "warm", "listener", "coffee", "travel", "chill"],
    distanceKm: 2,
    topEmojis: ["☕", "🎬"],
  },
  {
    id: "femke",
    name: "Femke",
    age: 28,
    photo: u("photo-1487412720507-e7ab37603c6f"),
    city: "Rotterdam",
    status: { variant: "replied", label: "Antwoordde 10s geleden" },
    isVerified: false,
    lastActive: "Vandaag actief",
    lookingFor: "Sportmaatje & late-night gesprekken",
    bio: "Hardloopster, festival-fan en zoeker van de beste ramen in elke stad. Eerlijke gesprekken boven alles.",
    gallery: [u("photo-1487412720507-e7ab37603c6f", 1200), ...EXTRA.femke],
    interests: [
      { label: "Fitness", icon: "caring" },
      { label: "Muziek", icon: "listener" },
      { label: "Foodie", icon: "playful" },
      { label: "Nachtuil", icon: "romantic" },
    ],
    vibe: ["gym", "listener", "playful", "romantic", "witty", "coffee", "travel"],
    funnelIntentIds: ["friends", "casual", "chatting", "notsure"],
    distanceKm: 2.4,
    topEmojis: ["🎧", "🏃"],
  },
  {
    id: "tara",
    name: "Tara",
    age: 27,
    photo: u("photo-1580489944761-15a19d654956"),
    city: "Utrecht",
    status: { variant: "new", label: "Nieuw" },
    isVerified: true,
    lastActive: "Vandaag actief",
    lookingFor: "Bioscoopdates & diepe gesprekken",
    bio: "Filmfanaat en verhalenverteller. Altijd in voor een goede einddiscussie en iemand die de aftiteling leest.",
    gallery: [u("photo-1580489944761-15a19d654956", 1200), ...EXTRA.tara],
    interests: [
      { label: "Films", icon: "listener" },
      { label: "Verhalen", icon: "romantic" },
      { label: "Speels", icon: "playful" },
      { label: "Warm gezelschap", icon: "warm" },
    ],
    vibe: ["movies", "romantic", "playful", "warm", "art", "coffee", "reading"],
    distanceKm: 3.1,
    topEmojis: ["🎬", "📚"],
  },
  {
    id: "olivia",
    name: "Olivia",
    age: 30,
    photo: u("photo-1573496359142-b8d87734a5a2"),
    city: "Den Haag",
    status: { variant: "popular", label: "Populair" },
    isVerified: false,
    lastActive: "Vandaag actief",
    lookingFor: "Rustige ochtenden & lekker eten",
    bio: "Thuiskok, weekendfietser en kookboekenverzamelaars. Van markten, luie zondagen en goede gesprekken.",
    gallery: [u("photo-1573496359142-b8d87734a5a2", 1200), ...EXTRA.olivia],
    interests: [
      { label: "Koken", icon: "warm" },
      { label: "Romantisch", icon: "romantic" },
      { label: "Zorgzaam", icon: "caring" },
      { label: "Goede luisteraar", icon: "listener" },
    ],
    vibe: ["warm", "romantic", "caring", "listener", "coffee", "chill", "reading"],
    distanceKm: 4.2,
    topEmojis: ["🍳", "☕"],
  },
  {
    id: "victoria",
    name: "Victoria",
    age: 29,
    photo: u("photo-1529626455594-4ff0802cfb7e"),
    city: "Eindhoven",
    status: { variant: "quiet", label: "Rustig vanavond" },
    isVerified: true,
    lastActive: "Vandaag actief",
    lookingFor: "Creatieve ziel & museumdates",
    bio: "In opleiding tot curator. Houd van openingsfeesten, vintage winkels en lange wandelingen met koffie. Ruilen we playlists?",
    gallery: [u("photo-1529626455594-4ff0802cfb7e", 1200), ...EXTRA.victoria],
    interests: [
      { label: "Kunst", icon: "romantic" },
      { label: "Muziek", icon: "listener" },
      { label: "Speels", icon: "playful" },
      { label: "Warm gezelschap", icon: "warm" },
    ],
    vibe: ["art", "romantic", "listener", "playful", "warm", "travel", "movies"],
    funnelIntentIds: ["meaningful", "friends", "chatting", "notsure"],
    distanceKm: 1.6,
    topEmojis: ["🎨", "✈️"],
  },
  {
    id: "clara",
    name: "Clara",
    age: 26,
    photo: u("photo-1524504388940-b1c1722653e1"),
    city: "Groningen",
    status: { variant: "online", label: "Online" },
    isVerified: false,
    lastActive: "Vandaag actief",
    lookingFor: "Doordachte gesprekken",
    bio: "Lezer, theedrinker en hobbybakker. Ik waardeer vriendelijkheid, nieuwsgierigheid en mensen die goede vervolgvragen stellen.",
    gallery: [u("photo-1524504388940-b1c1722653e1", 1200), ...EXTRA.clara],
    interests: [
      { label: "Boeken", icon: "listener" },
      { label: "Zorgzaam", icon: "caring" },
      { label: "Romantisch", icon: "romantic" },
      { label: "Goede luisteraar", icon: "listener" },
    ],
    vibe: ["reading", "listener", "caring", "romantic", "coffee", "warm", "chill"],
    distanceKm: 2.2,
    topEmojis: ["📚", "☕"],
  },
  ...newHereProfiles(),
];

/** Maya → Clara — matches home discovery grid order. */
export const homeGridProfiles: Profile[] = profiles.slice(0, 6);

export function getProfileById(id: string): Profile | undefined {
  return profiles.find((p) => p.id === id);
}

/** Tiny avatars for the bottom "likes" strip — subset of profile photos. */
export const likesPreviewAvatarUrls: string[] = [
  profiles[0].photo,
  profiles[4].photo,
  profiles[5].photo,
];
