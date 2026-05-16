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

import { BASE_PACK_CREDITS, BASE_PACK_PRICE_EUR } from "@/lib/credits/pricing";

const perCreditBase = BASE_PACK_PRICE_EUR / BASE_PACK_CREDITS;

export const packages: CreditPackage[] = [
  {
    id: "100",
    credits: 100,
    bonus: 0,
    price: 9.99,
    original: 9.99,
    perCredit: perCreditBase,
    icon: "⭐",
    tile: "from-[#7C5CFF] to-[#9B7BFF]",
    defaultSelected: true,
  },
  {
    id: "250",
    credits: 250,
    bonus: 50,
    price: 19.99,
    original: 24.98,
    perCredit: 0.08,
    icon: "🎂",
    tile: "from-pink-400 to-pink-500",
    badge: "most-popular",
    defaultSelected: true,
  },
  {
    id: "500",
    credits: 500,
    bonus: 150,
    price: 34.99,
    original: 49.95,
    perCredit: 0.07,
    icon: "👜",
    tile: "from-orange-400 to-orange-500",
    badge: "trending",
  },
  {
    id: "1000",
    credits: 1000,
    bonus: 400,
    price: 59.99,
    original: 99.90,
    perCredit: 0.05,
    icon: "🔐",
    tile: "from-yellow-400 to-amber-500",
    badge: "best-value",
  },
];

/** Countdown seed: 23:59:39 — resets to this when it hits 0. */
export const offerCountdownInitialSeconds =
  23 * 3600 + 59 * 60 + 39;
