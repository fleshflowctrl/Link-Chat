/**
 * Welcome screen (funnel step 1) — cycling card sets.
 *
 * These are the FALLBACK reels shown when the live chat_profiles
 * catalog is empty (fresh DB / Supabase unreachable). In normal
 * production the funnel uses real personas via
 * `buildWelcomeSetsFromCatalog` in components/funnel/onboarding-funnel.tsx.
 *
 * Photos: Unsplash (same style as `profiles.ts`).
 */

const u = (id: string, w = 800) =>
  `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`;

export type FunnelWelcomeCard = {
  id: string;
  name: string;
  age: number;
  photo: string;
  /** Shown under the name. Holds a city now (operator-requested):
   * "Amsterdam", "Utrecht", etc. — used to be a "5 km" distance. */
  city: string | null;
  status: "online" | "new" | null;
};

export const funnelSets: FunnelWelcomeCard[][] = [
  [
    {
      id: "maya",
      name: "Maya",
      age: 26,
      photo: u("photo-1534528741775-53994a69daeb"),
      city: "Amsterdam",
      status: "online",
    },
    {
      id: "marcus",
      name: "Marcus",
      age: 29,
      photo: u("photo-1506794778202-cad84cf45f1d"),
      city: "Utrecht",
      status: "new",
    },
    {
      id: "clara",
      name: "Clara",
      age: 24,
      photo: u("photo-1524504388940-b1c1722653e1"),
      city: "Rotterdam",
      status: "new",
    },
    {
      id: "sophie",
      name: "Sophie",
      age: 28,
      photo: u("photo-1544005313-94ddf0286df2"),
      city: "Den Haag",
      status: "online",
    },
  ],
  [
    {
      id: "lena",
      name: "Lena",
      age: 27,
      photo: u("photo-1494790108377-be9c29b29330"),
      city: "Eindhoven",
      status: "new",
    },
    {
      id: "iris",
      name: "Iris",
      age: 25,
      photo: u("photo-1531746020798-e6953c6e8e04"),
      city: "Groningen",
      status: "online",
    },
    {
      id: "zoe",
      name: "Zoe",
      age: 26,
      photo: u("photo-1529626455594-4ff0802cfb7e"),
      city: "Tilburg",
      status: "new",
    },
    {
      id: "nina",
      name: "Nina",
      age: 30,
      photo: u("photo-1517841905240-472988babdf9"),
      city: "Breda",
      status: "online",
    },
  ],
  [
    {
      id: "mia",
      name: "Mia",
      age: 25,
      photo: u("photo-1529626455594-4ff0802cfb7e"),
      city: "Nijmegen",
      status: "online",
    },
    {
      id: "ava",
      name: "Ava",
      age: 23,
      photo: u("photo-1438761681033-6461ffad8d80"),
      city: "Haarlem",
      status: "new",
    },
    {
      id: "liam",
      name: "Liam",
      age: 28,
      photo: u("photo-1472099645785-5658abf4ff4e"),
      city: "Amersfoort",
      status: "new",
    },
    {
      id: "noah",
      name: "Noah",
      age: 27,
      photo: u("photo-1507003211169-0a1dd7228f2d"),
      city: "Maastricht",
      status: "online",
    },
  ],
];
