export type OnlineUser = {
  id: string;
  name: string;
  avatar: string;
  isOnline: boolean;
};

/** Mock “online now” list — header count uses `getOnlineUsers().length`. */
const SEED: OnlineUser[] = [
  {
    id: "maya",
    name: "Maya",
    avatar:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80&auto=format&fit=crop",
    isOnline: true,
  },
  {
    id: "clara",
    name: "Clara",
    avatar:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&q=80&auto=format&fit=crop",
    isOnline: true,
  },
  {
    id: "sophie",
    name: "Sophie",
    avatar:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&q=80&auto=format&fit=crop",
    isOnline: true,
  },
  {
    id: "marcus",
    name: "Marcus",
    avatar:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&q=80&auto=format&fit=crop",
    isOnline: true,
  },
  {
    id: "victoria",
    name: "Victoria",
    avatar:
      "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=200&q=80&auto=format&fit=crop",
    isOnline: true,
  },
  {
    id: "lena",
    name: "Lena",
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80&auto=format&fit=crop",
    isOnline: true,
  },
  {
    id: "thomas",
    name: "Thomas",
    avatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80&auto=format&fit=crop",
    isOnline: true,
  },
  {
    id: "mia",
    name: "Mia",
    avatar:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80&auto=format&fit=crop",
    isOnline: true,
  },
  {
    id: "oliver",
    name: "Oliver",
    avatar:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80&auto=format&fit=crop",
    isOnline: true,
  },
  {
    id: "ava",
    name: "Ava",
    avatar:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80&auto=format&fit=crop",
    isOnline: true,
  },
];

export function getOnlineUsers(): OnlineUser[] {
  return SEED.filter((u) => u.isOnline);
}
