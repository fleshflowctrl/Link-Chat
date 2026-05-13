const u = (id: string, w = 800) =>
  `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`;

export type ContentCategory = "exclusive" | "lingerie" | "selfie" | "outdoor";

export type ContentSet = {
  id: string;
  creatorId: string;
  creatorName: string;
  creatorAge: number;
  creatorCity: string;
  creatorAvatar: string;
  /** Cover — shown blurred when locked */
  coverPhoto: string;
  /** All photos in the set (shown after unlock) */
  photos: string[];
  title: string;
  description: string;
  credits: number;
  category: ContentCategory;
  previewCount: number;
  isNew?: boolean;
  isHot?: boolean;
};

export const contentSets: ContentSet[] = [
  {
    id: "set-maya-1",
    creatorId: "maya",
    creatorName: "Maya",
    creatorAge: 26,
    creatorCity: "Amsterdam",
    creatorAvatar: u("photo-1534528741775-53994a69daeb", 200),
    coverPhoto: u("photo-1517841905240-472988babdf9"),
    photos: [
      u("photo-1517841905240-472988babdf9", 1200),
      u("photo-1529626455594-4ff0802cfb7e", 1200),
      u("photo-1524504388940-b1c1722653e1", 1200),
      u("photo-1494790108377-be9c29b29330", 1200),
      u("photo-1438761681033-6461ffad8d80", 1200),
    ],
    title: "Golden hour ✨",
    description: "Late afternoon shoot — my favorite light.",
    credits: 25,
    category: "exclusive",
    previewCount: 1,
    isNew: true,
  },
  {
    id: "set-elena-1",
    creatorId: "elena",
    creatorName: "Elena",
    creatorAge: 27,
    creatorCity: "Rotterdam",
    creatorAvatar: u("photo-1524504388940-b1c1722653e1", 200),
    coverPhoto: u("photo-1531746020798-e6953c6e8e04"),
    photos: [
      u("photo-1531746020798-e6953c6e8e04", 1200),
      u("photo-1544005313-94ddf0286df2", 1200),
      u("photo-1506794778202-cad84cf45f1d", 1200),
    ],
    title: "Lazy Sunday 🌿",
    description: "Soft & cozy, just how I like it.",
    credits: 20,
    category: "selfie",
    previewCount: 1,
    isHot: true,
  },
  {
    id: "set-victoria-1",
    creatorId: "victoria",
    creatorName: "Victoria",
    creatorAge: 29,
    creatorCity: "Eindhoven",
    creatorAvatar: u("photo-1529626455594-4ff0802cfb7e", 200),
    coverPhoto: u("photo-1513506003901-1e6a229e2d15"),
    photos: [
      u("photo-1513506003901-1e6a229e2d15", 1200),
      u("photo-1460661419201-fd4cecdf8a8b", 1200),
      u("photo-1513364776144-60967b0f800f", 1200),
      u("photo-1549887534-1541e9326642", 1200),
    ],
    title: "Art & me 🎨",
    description: "Shot at a gallery opening — felt right.",
    credits: 30,
    category: "outdoor",
    previewCount: 1,
  },
  {
    id: "set-clara-1",
    creatorId: "clara",
    creatorName: "Clara",
    creatorAge: 26,
    creatorCity: "Groningen",
    creatorAvatar: u("photo-1524504388940-b1c1722653e1", 200),
    coverPhoto: u("photo-1512820790803-83ca734da794"),
    photos: [
      u("photo-1512820790803-83ca734da794", 1200),
      u("photo-1481627834876-b9933fe8c685", 1200),
      u("photo-1519682337058-a94d519337bc", 1200),
    ],
    title: "Reading nook 📚",
    description: "Where I spend most of my time honestly.",
    credits: 15,
    category: "selfie",
    previewCount: 1,
  },
  {
    id: "set-nina-1",
    creatorId: "nina",
    creatorName: "Nina",
    creatorAge: 24,
    creatorCity: "Utrecht",
    creatorAvatar: u("photo-1531746020798-e6953c6e8e04", 200),
    coverPhoto: u("photo-1438761681033-6461ffad8d80"),
    photos: [
      u("photo-1438761681033-6461ffad8d80", 1200),
      u("photo-1517841905240-472988babdf9", 1200),
      u("photo-1544005313-94ddf0286df2", 1200),
      u("photo-1534528741775-53994a69daeb", 1200),
      u("photo-1529626455594-4ff0802cfb7e", 1200),
      u("photo-1524504388940-b1c1722653e1", 1200),
    ],
    title: "Summer set 🌞",
    description: "Best 6 from this summer — all exclusive.",
    credits: 40,
    category: "exclusive",
    previewCount: 2,
    isHot: true,
    isNew: false,
  },
  {
    id: "set-sophie-1",
    creatorId: "sophie",
    creatorName: "Sophie",
    creatorAge: 25,
    creatorCity: "Haarlem",
    creatorAvatar: u("photo-1544005313-94ddf0286df2", 200),
    coverPhoto: u("photo-1494790108377-be9c29b29330"),
    photos: [
      u("photo-1494790108377-be9c29b29330", 1200),
      u("photo-1438761681033-6461ffad8d80", 1200),
      u("photo-1517841905240-472988babdf9", 1200),
    ],
    title: "Morning glow ☀️",
    description: "Natural light, no filter.",
    credits: 20,
    category: "selfie",
    previewCount: 1,
    isNew: true,
  },
];

export const CATEGORY_LABELS: Record<ContentCategory, string> = {
  exclusive: "Exclusief",
  lingerie: "Lingerie",
  selfie: "Selfie",
  outdoor: "Buiten",
};
