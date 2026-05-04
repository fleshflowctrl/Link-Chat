export type CreditPackTopBadge = "most-popular" | "trending" | "best-value";

export interface CreditPackage {
  id: string;
  credits: number;
  bonus: number;
  price: number;
  original: number;
  perCredit: number;
  icon: string;
  /** Tailwind gradient stops (applied with `bg-gradient-to-br`). */
  tile: string;
  /** Optional top-left ribbon. */
  badge?: CreditPackTopBadge;
  /** Green “Save 20%” pill top-right (e.g. most popular pack). */
  saveBadge?: boolean;
  defaultSelected?: boolean;
}

export const packages: CreditPackage[] = [
  {
    id: "100",
    credits: 100,
    bonus: 20,
    price: 9.99,
    original: 12.49,
    perCredit: 0.1,
    icon: "⭐",
    tile: "from-[#7C5CFF] to-[#9B7BFF]",
    badge: "most-popular",
    saveBadge: true,
    defaultSelected: true,
  },
  {
    id: "250",
    credits: 250,
    bonus: 50,
    price: 19.99,
    original: 24.99,
    perCredit: 0.08,
    icon: "🎂",
    tile: "from-pink-400 to-pink-500",
  },
  {
    id: "500",
    credits: 500,
    bonus: 120,
    price: 34.99,
    original: 43.99,
    perCredit: 0.07,
    icon: "👜",
    tile: "from-orange-400 to-orange-500",
    badge: "trending",
  },
  {
    id: "1000",
    credits: 1000,
    bonus: 250,
    price: 59.99,
    original: 74.99,
    perCredit: 0.05,
    icon: "🔐",
    tile: "from-yellow-400 to-amber-500",
    badge: "best-value",
  },
];

/** Countdown seed: 23:59:39 — resets to this when it hits 0. */
export const offerCountdownInitialSeconds =
  23 * 3600 + 59 * 60 + 39;
