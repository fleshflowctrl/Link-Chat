export type ChatFilterId =
  | "links"
  | "active"
  | "replies"
  | "online"
  | "more";

export interface MessageThread {
  id: string;
  name: string;
  avatarUrl: string;
  lastMessage: string;
  /** Shown top-right, e.g. 10:32, Yesterday, 2d ago */
  timestampLabel: string;
  /** Purple “Online now” line under preview */
  onlineNow?: boolean;
  /** Green dot on avatar */
  showOnlineDot?: boolean;
  verified?: boolean;
  unreadCount?: number;
  /** Quick-filter chips this row belongs to */
  filterTags: ChatFilterId[];
}

export interface ChatFilterChip {
  id: ChatFilterId;
  label: string;
  avatarUrl: string;
  badge?: { kind: "count" | "plus"; value: string };
  showOnlineDot?: boolean;
}

/** Horizontal filter row — avatars + labels + badges (decorative counts where noted). */
export const chatFilterChips: ChatFilterChip[] = [
  {
    id: "links",
    label: "Your links",
    avatarUrl:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&q=80&auto=format&fit=crop",
    showOnlineDot: true,
  },
  {
    id: "active",
    label: "Active now",
    avatarUrl:
      "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=120&q=80&auto=format&fit=crop",
    showOnlineDot: true,
  },
  {
    id: "replies",
    label: "New replies",
    avatarUrl:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&q=80&auto=format&fit=crop",
    badge: { kind: "count", value: "2" },
  },
  {
    id: "online",
    label: "Online",
    avatarUrl:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&q=80&auto=format&fit=crop",
    badge: { kind: "count", value: "5" },
  },
  {
    id: "more",
    label: "More",
    avatarUrl:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&q=80&auto=format&fit=crop",
    badge: { kind: "plus", value: "7" },
  },
];

export const messageThreads: MessageThread[] = [
  {
    id: "maya",
    name: "Maya",
    avatarUrl:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80&auto=format&fit=crop",
    lastMessage: "Hey! Where are you from?",
    timestampLabel: "10:32",
    onlineNow: true,
    showOnlineDot: true,
    verified: true,
    unreadCount: 1,
    filterTags: ["links", "active", "replies", "online"],
  },
  {
    id: "elena",
    name: "Elena",
    avatarUrl:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&q=80&auto=format&fit=crop",
    lastMessage: "You seem fun 😊",
    timestampLabel: "Yesterday",
    onlineNow: true,
    showOnlineDot: true,
    unreadCount: 2,
    filterTags: ["links", "active", "replies", "online"],
  },
  {
    id: "sophie",
    name: "Sophie",
    avatarUrl:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&q=80&auto=format&fit=crop",
    lastMessage: "Thanks for the chat!",
    timestampLabel: "Yesterday",
    showOnlineDot: true,
    filterTags: ["links", "online"],
  },
  {
    id: "julia",
    name: "Julia",
    avatarUrl:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&q=80&auto=format&fit=crop",
    lastMessage: "It was nice talking to you",
    timestampLabel: "2d ago",
    filterTags: ["more"],
  },
  {
    id: "nina",
    name: "Nina",
    avatarUrl:
      "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&q=80&auto=format&fit=crop",
    lastMessage: "Hey, how's your day?",
    timestampLabel: "2d ago",
    filterTags: ["more"],
  },
];

export function threadsForFilter(filterId: ChatFilterId | null): MessageThread[] {
  if (filterId == null) {
    return messageThreads;
  }
  return messageThreads.filter((t) => t.filterTags.includes(filterId));
}
