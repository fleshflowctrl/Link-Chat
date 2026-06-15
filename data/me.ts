export type MeSettingsIconKey =
  | "shield"
  | "lock"
  | "credit"
  | "history"
  | "gift"
  | "help";

/** Display order for the stat grid. */
export const meStatGridOrder = ["chats", "credits"] as const;
export type MeStatKey = (typeof meStatGridOrder)[number];

/** Labels and styling for Me stat cards — numeric values come from the database. */
export const meStatCardLayout: Record<
  MeStatKey,
  { label: string; subtitle: string; emoji: string; cardBg: string }
> = {
  chats: {
    label: "Chats",
    subtitle: "Open gesprekken",
    emoji: "💬",
    cardBg: "bg-purple-100",
  },
  credits: {
    label: "Berichtenbundels",
    subtitle: "Opwaarderen voor meer chat",
    emoji: "✨",
    cardBg: "bg-amber-100",
  },
};

/** Legacy demo aggregate for screens not yet wired to Supabase (messages strip, credits page). */
export const meProfile = {
  firstName: "Emily",
  age: 28,
  location: "Amsterdam, NL",
  bioLine1: "Koffieliefhebber ☕ · Reizen ✈️",
  bioLine2: "Op zoek naar echte gesprekken en goede vibes.",
  avatarUrl:
    "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=720&q=80&auto=format&fit=crop",
  verified: true,
  stats: {
    chats: { ...meStatCardLayout.chats, value: 12 },
    credits: { ...meStatCardLayout.credits, value: 100 },
  },
};

/** Home header bell — set to `0` to hide the unread badge. */
export const homeUnreadNotificationCount = 3;

export type MeSettingsRow = {
  href: string;
  title: string;
  subtitle: string;
  icon: MeSettingsIconKey;
  /** Pink pill before chevron (e.g. Earn free sparkles). */
  bonusPill?: string;
};

export type MeSettingsSection = {
  label: string;
  rows: MeSettingsRow[];
};

export const meSettingsSections: MeSettingsSection[] = [
  {
    label: "BETALING",
    rows: [
      {
        href: "/me/payment",
        title: "Betaalmethoden",
        subtitle: "Kaarten en abonnementen beheren",
        icon: "credit",
      },
    ],
  },
  {
    label: "ONDERSTEUNING",
    rows: [
      {
        href: "/me/help",
        title: "Help & ondersteuning",
        subtitle: "Hulp nodig of contact opnemen",
        icon: "help",
      },
    ],
  },
];
