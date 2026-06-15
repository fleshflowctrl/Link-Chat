export type CreditPackTopBadge = "trending" | "best-value";

export interface CreditPackage {
  id: string;
  /** User-facing bundle name (Starterbundel, Populaire bundel, …). */
  bundleLabel: string;
  credits: number;
  bonus: number;
  price: number;
  original: number;
  perCredit: number;
  icon: string;
  /** Asset filename suffix in `/assets/credits_<iconAsset>.png`. */
  iconAsset: 100 | 250 | 500 | 1000;
  /** Tailwind gradient stops (applied with `bg-gradient-to-br`). */
  tile: string;
  /** Optional top-left ribbon. */
  badge?: CreditPackTopBadge;
  /** Green “Save 20%” pill top-right (e.g. most popular pack). */
  saveBadge?: boolean;
  defaultSelected?: boolean;
  /** Only available while `purchase_count === 0`. */
  firstPurchaseOnly?: boolean;
}

import { pointsForPackPriceEur } from "@/lib/credits/pricing";

function pack(
  price: number,
  bonusPercent: number,
  rest: Omit<CreditPackage, "credits" | "bonus" | "price" | "original" | "perCredit">,
): CreditPackage {
  const credits = pointsForPackPriceEur(price);
  const bonus = bonusPercent > 0 ? Math.round(credits * bonusPercent) : 0;
  const total = credits + bonus;
  return {
    ...rest,
    price,
    original: price,
    credits,
    bonus,
    perCredit: total > 0 ? price / total : 0,
  };
}

export const FIRST_PURCHASE_PACKAGE_ID = "welcome";

export const packages: CreditPackage[] = [
  pack(19.99, 0, {
    id: "1000",
    bundleLabel: "Starterbundel",
    icon: "⭐",
    iconAsset: 100,
    tile: "from-[#7C5CFF] to-[#9B7BFF]",
    defaultSelected: true,
  }),
  pack(39.99, 0.4, {
    id: "2500",
    bundleLabel: "Populaire bundel",
    icon: "🎂",
    iconAsset: 250,
    tile: "from-pink-400 to-pink-500",
    defaultSelected: true,
  }),
  pack(69.99, 0.4, {
    id: "5000",
    bundleLabel: "Voordeelbundel",
    icon: "👜",
    iconAsset: 500,
    tile: "from-orange-400 to-orange-500",
  }),
  pack(119.99, 0.4, {
    id: "10000",
    bundleLabel: "XL bundel",
    icon: "🔐",
    iconAsset: 1000,
    tile: "from-yellow-400 to-amber-500",
  }),
];

/** One-time welcome offer — only while the user has never bought a bundle. */
export const firstPurchasePackage: CreditPackage = {
  id: FIRST_PURCHASE_PACKAGE_ID,
  bundleLabel: "Welkomstbundel",
  credits: 200,
  bonus: 0,
  price: 19.99,
  original: 39.99,
  perCredit: 19.99 / 200,
  icon: "🎁",
  iconAsset: 250,
  tile: "from-[#B52B2A] to-[#8B2221]",
  firstPurchaseOnly: true,
};

export const bonusPackages = packages.filter((pkg) => pkg.bonus > 0);

export const starterPackage = packages.find((pkg) => pkg.bonus <= 0) ?? packages[0];

export function findCreditPackage(id: string): CreditPackage | undefined {
  if (id === firstPurchasePackage.id) return firstPurchasePackage;
  return packages.find((p) => p.id === id);
}

export function allCreditPackages(): CreditPackage[] {
  return [firstPurchasePackage, ...packages];
}

/** Countdown seed: 23:59:39 — resets to this when it hits 0. */
export const offerCountdownInitialSeconds =
  23 * 3600 + 59 * 60 + 39;
