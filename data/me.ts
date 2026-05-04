export type MeSettingsIconKey =
  | "shield"
  | "lock"
  | "credit"
  | "history"
  | "gift"
  | "help";

export const meProfile = {
  firstName: "Emily",
  age: 28,
  location: "London, UK",
  bioLine1: "Coffee lover ☕ | Travel addict ✈️",
  bioLine2: "Looking for real conversations and good vibes.",
  avatarUrl:
    "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=720&q=80&auto=format&fit=crop",
  verified: true,
  stats: {
    chats: {
      value: 12,
      label: "Chats",
      subtitle: "Open conversations",
      emoji: "💬",
      tone: "purple" as const,
    },
    likes: {
      value: 46,
      label: "Likes",
      subtitle: "People who liked you",
      emoji: "❤️",
      tone: "pink" as const,
    },
    links: {
      value: 3,
      label: "Links",
      subtitle: "You’re linked",
      emoji: "⭐",
      tone: "yellow" as const,
    },
    credits: {
      value: 125,
      label: "Credits",
      subtitle: "Top up to chat more",
      emoji: "💲",
      tone: "green" as const,
    },
  },
};

export type MeSettingsRow = {
  href: string;
  title: string;
  subtitle: string;
  icon: MeSettingsIconKey;
};

export const meSettingsRows: MeSettingsRow[] = [
  {
    href: "/me/account",
    title: "Account & security",
    subtitle: "Manage your account and privacy",
    icon: "shield",
  },
  {
    href: "/me/privacy",
    title: "Privacy settings",
    subtitle: "Control who can see you and contact you",
    icon: "lock",
  },
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
    title: "Earn free credits",
    subtitle: "Invite friends and get free credits",
    icon: "gift",
  },
  {
    href: "/me/help",
    title: "Help & support",
    subtitle: "Get help or contact us",
    icon: "help",
  },
];
