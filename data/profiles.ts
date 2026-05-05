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
  distanceKm: number;
  /** Short line on home cards & list snippets. */
  bioSnippet: string;
  status: {
    variant: ProfileStatusVariant;
    label: string;
  };
  /** Initial like state for home grid (client may override). */
  liked: boolean;
  presenceLabel: string;
  /** Long-form bio on profile detail */
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
  ): Profile => ({
    id,
    name,
    age: 25,
    photo: u(photoId),
    distanceKm: 4,
    bioSnippet: "New on whisper ✨",
    status: { variant: "new", label: "New" },
    liked: false,
    presenceLabel: "Just joined",
    isVerified: false,
    lastActive: "Just now",
    lookingFor: "Good conversations",
    bio: `${name} recently joined whisper.`,
    gallery: g(photoId),
    interests: [
      { label: "New here", icon: "listener" },
      { label: "Friendly", icon: "warm" },
    ],
  });
  return [
    row("sophie", "Sophie", "photo-1544005313-94ddf0286df2"),
    row("lena", "Lena", "photo-1494790108377-be9c29b29330"),
    row("mia", "Mia", "photo-1534528741775-53994a69daeb"),
    row("ava", "Ava", "photo-1438761681033-6461ffad8d80"),
    row("zoe", "Zoe", "photo-1529626455594-4ff0802cfb7e"),
    row("iris", "Iris", "photo-1531746020798-e6953c6e8e04"),
    row("nora", "Nora", "photo-1517841905240-472988babdf9"),
  ];
}

/** Seed profiles — extend `gallery`, `bio`, and `interests` as you grow the app. */
export const profiles: Profile[] = [
  {
    id: "maya",
    name: "Maya",
    age: 26,
    photo: u("photo-1534528741775-53994a69daeb"),
    distanceKm: 2,
    bioSnippet: "Loves coffee & deep talks ☕",
    status: { variant: "active", label: "Active now" },
    liked: false,
    presenceLabel: "Active now",
    isVerified: true,
    lastActive: "Active today",
    lookingFor: "Meaningful connection",
    bio: "Into good coffee, road trips and meaningful conversations. Soft & warm — not here for games. Let's vibe and see where it goes 🌿",
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
      { label: "Caring", icon: "caring" },
      { label: "Romantic", icon: "romantic" },
      { label: "Playful", icon: "playful" },
      { label: "Warm company", icon: "warm" },
      { label: "Good listener", icon: "listener" },
    ],
  },
  {
    id: "marcus",
    name: "Marcus",
    age: 29,
    photo: u("photo-1506794778202-cad84cf45f1d"),
    distanceKm: 5,
    bioSnippet: "Night runs & good playlists 🎧",
    status: { variant: "replied", label: "Replied 10s ago" },
    liked: false,
    presenceLabel: "Active now",
    isVerified: false,
    lastActive: "Active today",
    lookingFor: "Running partner & late-night talks",
    bio: "Engineer by day, runner by night. I love honest conversation, live music, and finding the best ramen in every city I visit.",
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
      { label: "Music", icon: "listener" },
      { label: "Foodie", icon: "playful" },
      { label: "Night owl", icon: "romantic" },
    ],
  },
  {
    id: "thomas",
    name: "Thomas",
    age: 27,
    photo: u("photo-1507003211169-0a1dd7228f2d"),
    distanceKm: 8,
    bioSnippet: "Film nerd · always down to chat 🎬",
    status: { variant: "new", label: "New" },
    liked: false,
    presenceLabel: "Active now",
    isVerified: true,
    lastActive: "Active today",
    lookingFor: "Cinema dates & deep dives",
    bio: "Film school grad. Always down to debate endings, share recommendations, and find someone who reads the credits.",
    gallery: [
      u("photo-1507003211169-0a1dd7228f2d", 1200),
      u("photo-1485846234645-a62644f84728", 1200),
      u("photo-1536440136628-849c177e76a1", 1200),
      u("photo-1440404653325-ab12749ad78d", 1200),
      u("photo-1478720568477-152d9b668e39", 1200),
      u("photo-1517604931442-7e02c8f4531e", 1200),
    ],
    interests: [
      { label: "Movies", icon: "listener" },
      { label: "Storytelling", icon: "romantic" },
      { label: "Playful", icon: "playful" },
      { label: "Warm company", icon: "warm" },
    ],
  },
  {
    id: "oliver",
    name: "Oliver",
    age: 38,
    photo: u("photo-1472099645785-5658abf4ff4e"),
    distanceKm: 12,
    bioSnippet: "Cooking Sundays & slow mornings 🍳",
    status: { variant: "popular", label: "Popular" },
    liked: false,
    presenceLabel: "Active now",
    isVerified: false,
    lastActive: "Active today",
    lookingFor: "Slow mornings & good food",
    bio: "Home cook, weekend cyclist, and collector of cookbooks I actually use. Looking for someone who enjoys farmers markets and lazy Sundays.",
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
      { label: "Cooking", icon: "warm" },
      { label: "Romantic", icon: "romantic" },
      { label: "Caring", icon: "caring" },
      { label: "Good listener", icon: "listener" },
    ],
  },
  {
    id: "victoria",
    name: "Victoria",
    age: 29,
    photo: u("photo-1529626455594-4ff0802cfb7e"),
    distanceKm: 3,
    bioSnippet: "Art galleries & vinyl finds 🎨",
    status: { variant: "quiet", label: "Quiet tonight" },
    liked: false,
    presenceLabel: "Active now",
    isVerified: true,
    lastActive: "Active today",
    lookingFor: "Creative soul & museum dates",
    bio: "Curator-in-training. I love gallery openings, vintage shops, and long walks with coffee in hand. Let's swap playlists.",
    gallery: [
      u("photo-1529626455594-4ff0802cfb7e", 1200),
      u("photo-1513506003901-1e6a229e2d15", 1200),
      u("photo-1460661419201-fd4cecdf8a8b", 1200),
      u("photo-1513364776144-60967b0f800f", 1200),
      u("photo-1549887534-1541e9326642", 1200),
      u("photo-1518996994638-b2b59f434c7c", 1200),
    ],
    interests: [
      { label: "Art", icon: "romantic" },
      { label: "Music", icon: "listener" },
      { label: "Playful", icon: "playful" },
      { label: "Warm company", icon: "warm" },
    ],
  },
  {
    id: "clara",
    name: "Clara",
    age: 26,
    photo: u("photo-1524504388940-b1c1722653e1"),
    distanceKm: 1,
    bioSnippet: "Books, tea, and honest convos 📚",
    status: { variant: "online", label: "Online" },
    liked: false,
    presenceLabel: "Active now",
    isVerified: false,
    lastActive: "Active today",
    lookingFor: "Thoughtful conversation",
    bio: "Reader, tea drinker, and amateur baker. I value kindness, curiosity, and people who ask good follow-up questions.",
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
      { label: "Books", icon: "listener" },
      { label: "Caring", icon: "caring" },
      { label: "Romantic", icon: "romantic" },
      { label: "Good listener", icon: "listener" },
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
