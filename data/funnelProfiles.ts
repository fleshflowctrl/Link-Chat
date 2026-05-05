/**
 * Welcome screen (funnel step 1) — cycling card sets. Photos: Unsplash (same style as `profiles.ts`).
 */

const u = (id: string, w = 800) =>
  `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`;

export type FunnelWelcomeCard = {
  id: string;
  name: string;
  age: number;
  photo: string;
  distance: string | null;
  status: "online" | "new" | null;
};

export const funnelSets: FunnelWelcomeCard[][] = [
  [
    {
      id: "maya",
      name: "Maya",
      age: 26,
      photo: u("photo-1534528741775-53994a69daeb"),
      distance: "2 km",
      status: "online",
    },
    {
      id: "marcus",
      name: "Marcus",
      age: 29,
      photo: u("photo-1506794778202-cad84cf45f1d"),
      distance: "5 km",
      status: "new",
    },
    {
      id: "clara",
      name: "Clara",
      age: 24,
      photo: u("photo-1524504388940-b1c1722653e1"),
      distance: null,
      status: null,
    },
    {
      id: "sophie",
      name: "Sophie",
      age: 28,
      photo: u("photo-1544005313-94ddf0286df2"),
      distance: "1 km",
      status: "online",
    },
  ],
  [
    {
      id: "lena",
      name: "Lena",
      age: 27,
      photo: u("photo-1494790108377-be9c29b29330"),
      distance: "4 km",
      status: "new",
    },
    {
      id: "iris",
      name: "Iris",
      age: 25,
      photo: u("photo-1531746020798-e6953c6e8e04"),
      distance: "8 km",
      status: "online",
    },
    {
      id: "zoe",
      name: "Zoe",
      age: 26,
      photo: u("photo-1529626455594-4ff0802cfb7e"),
      distance: null,
      status: null,
    },
    {
      id: "nina",
      name: "Nina",
      age: 30,
      photo: u("photo-1517841905240-472988babdf9"),
      distance: "3 km",
      status: "new",
    },
  ],
  [
    {
      id: "mia",
      name: "Mia",
      age: 25,
      photo: u("photo-1529626455594-4ff0802cfb7e"),
      distance: "5 km",
      status: "online",
    },
    {
      id: "ava",
      name: "Ava",
      age: 23,
      photo: u("photo-1438761681033-6461ffad8d80"),
      distance: "2 km",
      status: null,
    },
    {
      id: "liam",
      name: "Liam",
      age: 28,
      photo: u("photo-1472099645785-5658abf4ff4e"),
      distance: "6 km",
      status: "new",
    },
    {
      id: "noah",
      name: "Noah",
      age: 27,
      photo: u("photo-1507003211169-0a1dd7228f2d"),
      distance: "4 km",
      status: "online",
    },
  ],
];
