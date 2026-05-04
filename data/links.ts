const u = (id: string, w = 400) =>
  `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`;

export type LinkRequest = {
  id: string;
  name: string;
  age: number;
  photo: string;
  bio: string;
  /** ISO — used for “Sent Xm ago” */
  sentAt: string;
  isNew?: boolean;
};

export type LinkedUser = {
  id: string;
  name: string;
  photo: string;
  isOnline: boolean;
};

/** Initial stats for the top card (Requests decreases on accept; Linked increases). */
export const initialLinkStats = {
  requestsReceived: 46,
  linkedCount: 12,
  sentCount: 8,
};

/** Incoming link requests — subset marked new for the pink pill. */
export const seedLinkRequests: LinkRequest[] = [
  {
    id: "sophie",
    name: "Sophie",
    age: 24,
    photo: u("photo-1544005313-94ddf0286df2"),
    bio: "Coffee shops, indie films, and slow Sundays.",
    sentAt: new Date(Date.now() - 4 * 60_000).toISOString(),
    isNew: true,
  },
  {
    id: "iris",
    name: "Iris",
    age: 27,
    photo: u("photo-1531746020798-e6953c6e8e04"),
    bio: "Runner, reader, always up for good pasta.",
    sentAt: new Date(Date.now() - 18 * 60_000).toISOString(),
    isNew: true,
  },
  {
    id: "nora",
    name: "Nora",
    age: 25,
    photo: u("photo-1517841905240-472988babdf9"),
    bio: "Art school grad. Let’s swap playlists.",
    sentAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
    isNew: true,
  },
  {
    id: "ava",
    name: "Ava",
    age: 29,
    photo: u("photo-1438761681033-6461ffad8d80"),
    bio: "Yoga mornings, spicy food, honest chats.",
    sentAt: new Date(Date.now() - 5 * 60 * 60_000).toISOString(),
    isNew: false,
  },
  {
    id: "zoe",
    name: "Zoe",
    age: 26,
    photo: u("photo-1529626455594-4ff0802cfb7e"),
    bio: "Weekend hikes and farmers markets.",
    sentAt: new Date(Date.now() - 26 * 60 * 60_000).toISOString(),
    isNew: false,
  },
  {
    id: "mia",
    name: "Mia",
    age: 23,
    photo: u("photo-1534528741775-53994a69daeb"),
    bio: "Photography, jazz bars, and long walks.",
    sentAt: new Date(Date.now() - 50 * 60 * 60_000).toISOString(),
    isNew: false,
  },
];

/** Core profiles for the grid (ids exist in `data/profiles.ts`). */
const linkedCore: LinkedUser[] = [
  { id: "maya", name: "Maya", photo: u("photo-1534528741775-53994a69daeb"), isOnline: true },
  { id: "marcus", name: "Marcus", photo: u("photo-1506794778202-cad84cf45f1d"), isOnline: true },
  { id: "thomas", name: "Thomas", photo: u("photo-1507003211169-0a1dd7228f2d"), isOnline: false },
  { id: "oliver", name: "Oliver", photo: u("photo-1472099645785-5658abf4ff4e"), isOnline: true },
  { id: "victoria", name: "Victoria", photo: u("photo-1529626455594-4ff0802cfb7e"), isOnline: false },
  { id: "clara", name: "Clara", photo: u("photo-1524504388940-b1c1722653e1"), isOnline: true },
  { id: "lena", name: "Lena", photo: u("photo-1494790108377-be9c29b29330"), isOnline: false },
];

/** 12 tiles — cycles `linkedCore` so every id resolves to `/profile/[id]`. */
export const seedLinkedUsers: LinkedUser[] = Array.from({ length: 12 }, (_, i) => {
  const row = linkedCore[i % linkedCore.length];
  return {
    ...row,
    isOnline: i % 3 === 0 ? true : row.isOnline,
  };
});

/** Relative time without trailing “ago” (UI: `Sent {x} ago`). */
export function formatSentAgo(sentAt: string, now = Date.now()): string {
  const diffMs = Math.max(0, now - new Date(sentAt).getTime());
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}
