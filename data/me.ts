export type MeSettingsIconKey =
  | "shield"
  | "lock"
  | "credit"
  | "history"
  | "gift"
  | "help";

/** Display order for the 2×2 stat grid. */
export const meStatGridOrder = ["chats", "links", "likes", "credits"] as const;
export type MeStatKey = (typeof meStatGridOrder)[number];

/** Labels and styling for Me stat cards — numeric values come from the database. */
export const meStatCardLayout: Record<
  MeStatKey,
  { label: string; subtitle: string; emoji: string; cardBg: string }
> = {
  chats: {
    label: "Chats",
    subtitle: "Open conversations",
    emoji: "💬",
    cardBg: "bg-purple-100",
  },
  links: {
    label: "Linked",
    subtitle: "You're linked",
    emoji: "🔗",
    cardBg: "bg-pink-100",
  },
  likes: {
    label: "Likes",
    subtitle: "People who liked you",
    emoji: "❤️",
    cardBg: "bg-rose-100",
  },
  credits: {
    label: "Sparkles",
    subtitle: "Top up to chat more",
    emoji: "✨",
    cardBg: "bg-amber-100",
  },
};

/** Legacy demo aggregate for screens not yet wired to Supabase (messages strip, credits page). */
export const meProfile = {
  firstName: "Emily",
  age: 28,
  location: "London, UK",
  bioLine1: "Coffee lover ☕ · Travel addict ✈️",
  bioLine2: "Looking for real conversations and good vibes.",
  avatarUrl:
    "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=720&q=80&auto=format&fit=crop",
  verified: true,
  stats: {
    chats: { ...meStatCardLayout.chats, value: 12 },
    links: { ...meStatCardLayout.links, value: 3 },
    likes: { ...meStatCardLayout.likes, value: 46 },
    credits: { ...meStatCardLayout.credits, value: 125 },
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
    label: "ACCOUNT",
    rows: [
      {
        href: "/me/account",
        title: "Account & security",
        subtitle: "Manage your account and privacy",
        icon: "shield",
      },
      {
        href: "/me/privacy",
        title: "Privacy settings",
        subtitle: "Control who can see and contact you",
        icon: "lock",
      },
    ],
  },
  {
    label: "BILLING",
    rows: [
      {
        href: "/me/payment",
        title: "Payment methods",
        subtitle: "Manage cards and subscriptions",
        icon: "credit",
      },
      {
        href: "/me/history",
        title: "Purchase history",
        subtitle: "View your past transactions",
        icon: "history",
      },
      {
        href: "/me/earn",
        title: "Earn free sparkles",
        subtitle: "Invite friends and get free sparkles",
        icon: "gift",
        bonusPill: "+50",
      },
    ],
  },
  {
    label: "SUPPORT",
    rows: [
      {
        href: "/me/help",
        title: "Help & support",
        subtitle: "Get help or contact us",
        icon: "help",
      },
    ],
  },
];
