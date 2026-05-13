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
    bio: "Koffiebars, indie-films en trage zondagen.",
    sentAt: new Date(Date.now() - 4 * 60_000).toISOString(),
    isNew: true,
  },
  {
    id: "iris",
    name: "Iris",
    age: 27,
    photo: u("photo-1531746020798-e6953c6e8e04"),
    bio: "Hardloper, lezer, altijd in voor goede pasta.",
    sentAt: new Date(Date.now() - 18 * 60_000).toISOString(),
    isNew: true,
  },
  {
    id: "nora",
    name: "Nora",
    age: 25,
    photo: u("photo-1517841905240-472988babdf9"),
    bio: "Afgestudeerd aan kunstacademie. Playlists ruilen?",
    sentAt: new Date(Date.now() - 2 * 60 * 60_000).toISOString(),
    isNew: true,
  },
  {
    id: "ava",
    name: "Ava",
    age: 29,
    photo: u("photo-1438761681033-6461ffad8d80"),
    bio: "Yoga-ochtenden, pittig eten, eerlijke gesprekken.",
    sentAt: new Date(Date.now() - 5 * 60 * 60_000).toISOString(),
    isNew: false,
  },
  {
    id: "zoe",
    name: "Zoe",
    age: 26,
    photo: u("photo-1529626455594-4ff0802cfb7e"),
    bio: "Weekendwandelingen en boerenmarkten.",
    sentAt: new Date(Date.now() - 26 * 60 * 60_000).toISOString(),
    isNew: false,
  },
  {
    id: "mia",
    name: "Mia",
    age: 23,
    photo: u("photo-1534528741775-53994a69daeb"),
    bio: "Fotografie, jazzbars en lange wandelingen.",
    sentAt: new Date(Date.now() - 50 * 60 * 60_000).toISOString(),
    isNew: false,
  },
];

/** Core profiles for the grid (ids exist in `data/profiles.ts`). */
const linkedCore: LinkedUser[] = [
  { id: "maya", name: "Maya", photo: u("photo-1534528741775-53994a69daeb"), isOnline: true },
  { id: "femke", name: "Femke", photo: u("photo-1487412720507-e7ab37603c6f"), isOnline: true },
  { id: "tara", name: "Tara", photo: u("photo-1580489944761-15a19d654956"), isOnline: false },
  { id: "olivia", name: "Olivia", photo: u("photo-1573496359142-b8d87734a5a2"), isOnline: true },
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

/** Volledige zin voor “verstuurd … geleden” in de koppelings-UI. */
export function formatLinkRequestSentLabel(sentAt: string, now = Date.now()): string {
  const diffMs = Math.max(0, now - new Date(sentAt).getTime());
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Zojuist verstuurd";
  if (mins < 60) return `${mins} min geleden verstuurd`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} u geleden verstuurd`;
  const days = Math.floor(hrs / 24);
  return `${days} d geleden verstuurd`;
}
