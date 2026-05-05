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
  /** Gallery photos — first is default hero; use ≥6 for thumbnail rail + extras */
  gallery: string[];
  interests: ProfileInterest[];
  lookingFor: string;
  lastActive: string;
  isVerified: boolean;
}

const u = (id: string, w = 800) =>
  `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`;

function newHereProfiles(): Profile[] {
  const g = (photo: string) =>
    [1200, 1200, 1200, 1200, 1200, 1200].map((w) => u(photo, w));
  const row = (
    id: string,
    name: string,
    photoId: string,
    city: string,
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
    bio: `${name} is net lid geworden van whisper.`,
    gallery: g(photoId),
    interests: [
      { label: "Nieuw hier", icon: "listener" },
      { label: "Vriendelijk", icon: "warm" },
    ],
  });
  return [
    row("sophie", "Sophie", "photo-1544005313-94ddf0286df2", "Haarlem"),
    row("lena", "Lena", "photo-1494790108377-be9c29b29330", "Maastricht"),
    row("mia", "Mia", "photo-1534528741775-53994a69daeb", "Leiden"),
    row("ava", "Ava", "photo-1438761681033-6461ffad8d80", "Zwolle"),
    row("zoe", "Zoe", "photo-1529626455594-4ff0802cfb7e", "Amersfoort"),
    row("iris", "Iris", "photo-1531746020798-e6953c6e8e04", "Delft"),
    row("nora", "Nora", "photo-1517841905240-472988babdf9", "Alkmaar"),
  ];
}

/** Seed profiles — extend `gallery`, `bio`, and `interests` as you grow the app. */
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
    gallery: [
      u("photo-1534528741775-53994a69daeb", 1200),
      u("photo-1517841905240-472988babdf9", 1200),
      u("photo-1529626455594-4ff0802cfb7e", 1200),
      u("photo-1494790108377-be9c29b29330", 1200),
      u("photo-1438761681033-6461ffad8d80", 1200),
      u("photo-1544005313-94ddf0286df2", 1200),
      u("photo-1506794778202-cad84cf45f1d", 1200),
      u("photo-1524504388940-b1c1722653e1", 1200),
    ],
    interests: [
      { label: "Zorgzaam", icon: "caring" },
      { label: "Romantisch", icon: "romantic" },
      { label: "Speels", icon: "playful" },
      { label: "Warm gezelschap", icon: "warm" },
      { label: "Goede luisteraar", icon: "listener" },
    ],
  },
  {
    id: "janifer",
    name: "Janifer",
    age: 24,
    photo: "/profiles/janifer/janifer-01.png",
    city: "Amsterdam",
    status: { variant: "new", label: "Nieuw" },
    isVerified: true,
    lastActive: "Vandaag actief",
    lookingFor: "Iemand om mee te lachen en echt mee te praten",
    bio: "Creatief, nieuwsgierig en licht chaotisch in een leuke zin. Ik hou van goede koffie, indie playlists en date-ideeën die niet uit een brochure komen. Geen drama — wel chemie.",
    gallery: [
      "/profiles/janifer/janifer-01.png",
      "/profiles/janifer/janifer-02.png",
      "/profiles/janifer/janifer-03.png",
      "/profiles/janifer/janifer-04.png",
      "/profiles/janifer/janifer-05.png",
      "/profiles/janifer/janifer-05.png",
    ],
    interests: [
      { label: "Muziek", icon: "listener" },
      { label: "Speels", icon: "playful" },
      { label: "Warm gezelschap", icon: "warm" },
      { label: "Romantisch", icon: "romantic" },
    ],
  },
  {
    id: "marcus",
    name: "Marcus",
    age: 29,
    photo: u("photo-1506794778202-cad84cf45f1d"),
    city: "Rotterdam",
    status: { variant: "replied", label: "Antwoordde 10s geleden" },
    isVerified: false,
    lastActive: "Vandaag actief",
    lookingFor: "Loopmaatje & nachtelijke gesprekken",
    bio: "Engineer overdag, hardloper ’s avonds. Ik hou van eerlijke gesprekken, live muziek en de beste ramen in elke stad.",
    gallery: [
      u("photo-1506794778202-cad84cf45f1d", 1200),
      u("photo-1500648767791-00dcc994a43e", 1200),
      u("photo-1472099645785-5658abf4ff4e", 1200),
      u("photo-1507003211169-0a1dd7228f2d", 1200),
      u("photo-1519085360753-af0119f7cbe7", 1200),
      u("photo-1560250097-0b93528c311a", 1200),
      u("photo-1570295999919-563bc1fe93f9", 1200),
    ],
    interests: [
      { label: "Fitness", icon: "caring" },
      { label: "Muziek", icon: "listener" },
      { label: "Foodie", icon: "playful" },
      { label: "Nachtuil", icon: "romantic" },
    ],
  },
  {
    id: "thomas",
    name: "Thomas",
    age: 27,
    photo: u("photo-1507003211169-0a1dd7228f2d"),
    city: "Utrecht",
    status: { variant: "new", label: "Nieuw" },
    isVerified: true,
    lastActive: "Vandaag actief",
    lookingFor: "Bioscoopdates & diepe gesprekken",
    bio: "Afgestudeerd aan filmschool. Altijd in voor discussies over einde, tips en iemand die de aftiteling leest.",
    gallery: [
      u("photo-1507003211169-0a1dd7228f2d", 1200),
      u("photo-1485846234645-a62644f84728", 1200),
      u("photo-1536440136628-849c177e76a1", 1200),
      u("photo-1440404653325-ab12749ad78d", 1200),
      u("photo-1478720568477-152d9b668e39", 1200),
      u("photo-1517604931442-7e02c8f4531e", 1200),
    ],
    interests: [
      { label: "Films", icon: "listener" },
      { label: "Verhalen", icon: "romantic" },
      { label: "Speels", icon: "playful" },
      { label: "Warm gezelschap", icon: "warm" },
    ],
  },
  {
    id: "oliver",
    name: "Oliver",
    age: 38,
    photo: u("photo-1472099645785-5658abf4ff4e"),
    city: "Den Haag",
    status: { variant: "popular", label: "Populair" },
    isVerified: false,
    lastActive: "Vandaag actief",
    lookingFor: "Rustige ochtenden & lekker eten",
    bio: "Thuiskok, weekendfietser en verzamelaar van kookboeken die ik echt gebruik. Zoek iemand die van markten en luie zondagen houdt.",
    gallery: [
      u("photo-1472099645785-5658abf4ff4e", 1200),
      u("photo-1546069901-ba9599a7e63c", 1200),
      u("photo-1556910103-1c02745aae4d", 1200),
      u("photo-1504674900240-87a09a9b9eac", 1200),
      u("photo-1495521821757-a1efb6729352", 1200),
      u("photo-1466637654771-963bcd662f46", 1200),
      u("photo-1540189549336-e6e99c3679fe", 1200),
    ],
    interests: [
      { label: "Koken", icon: "warm" },
      { label: "Romantisch", icon: "romantic" },
      { label: "Zorgzaam", icon: "caring" },
      { label: "Goede luisteraar", icon: "listener" },
    ],
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
    gallery: [
      u("photo-1529626455594-4ff0802cfb7e", 1200),
      u("photo-1513506003901-1e6a229e2d15", 1200),
      u("photo-1460661419201-fd4cecdf8a8b", 1200),
      u("photo-1513364776144-60967b0f800f", 1200),
      u("photo-1549887534-1541e9326642", 1200),
      u("photo-1518996994638-b2b59f434c7c", 1200),
    ],
    interests: [
      { label: "Kunst", icon: "romantic" },
      { label: "Muziek", icon: "listener" },
      { label: "Speels", icon: "playful" },
      { label: "Warm gezelschap", icon: "warm" },
    ],
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
    gallery: [
      u("photo-1524504388940-b1c1722653e1", 1200),
      u("photo-1512820790803-83ca734da794", 1200),
      u("photo-1481627834876-b9933fe8c685", 1200),
      u("photo-1506880012583-1c7c1aa8d1e2", 1200),
      u("photo-1519682337058-a94d519337bc", 1200),
      u("photo-1524995997946-a1c2e315a42f", 1200),
      u("photo-1495447166558-672aa57e8be9", 1200),
      u("photo-1516979187457-6378804f37d7", 1200),
    ],
    interests: [
      { label: "Boeken", icon: "listener" },
      { label: "Zorgzaam", icon: "caring" },
      { label: "Romantisch", icon: "romantic" },
      { label: "Goede luisteraar", icon: "listener" },
    ],
  },
  ...newHereProfiles(),
];

/** Maya → Clara — matches home discovery grid order. */
export const homeGridProfiles: Profile[] = profiles.slice(0, 6);

export function getProfileById(id: string): Profile | undefined {
  return profiles.find((p) => p.id === id);
}

/** Tiny avatars for the bottom “likes” strip — subset of profile photos. */
export const likesPreviewAvatarUrls: string[] = [
  profiles[0].photo,
  profiles[4].photo,
  profiles[5].photo,
];
