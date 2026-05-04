export type CreditPackageVariant = "purple" | "pink" | "orange" | "yellow";

export interface CreditPackage {
  id: string;
  credits: number;
  bonusCredits: number;
  subtitle: string;
  price: string;
  originalPrice: string;
  variant: CreditPackageVariant;
  /** “Most popular” ribbon above card */
  mostPopular?: boolean;
  /** Default selection on load */
  defaultSelected?: boolean;
}

export const creditPackages: CreditPackage[] = [
  {
    id: "starter",
    credits: 100,
    bonusCredits: 20,
    subtitle: "Start more conversations",
    price: "$9.99",
    originalPrice: "$12.49",
    variant: "purple",
    mostPopular: true,
    defaultSelected: true,
  },
  {
    id: "regular",
    credits: 250,
    bonusCredits: 50,
    subtitle: "Great for regular chatters",
    price: "$19.99",
    originalPrice: "$24.99",
    variant: "pink",
  },
  {
    id: "value",
    credits: 500,
    bonusCredits: 120,
    subtitle: "More chats, more possibilities",
    price: "$34.99",
    originalPrice: "$43.99",
    variant: "orange",
  },
  {
    id: "best",
    credits: 1000,
    bonusCredits: 250,
    subtitle: "Best value for active users",
    price: "$59.99",
    originalPrice: "$74.99",
    variant: "yellow",
  },
];

export const creditBalance = 12;

/** Initial countdown: 23:59:47 → total seconds until midnight-style display */
export const offerCountdownInitialSeconds =
  23 * 3600 + 59 * 60 + 47;
