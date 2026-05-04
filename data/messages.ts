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
    lastMessage: "Yes! Let's plan it this weekend?",
    timestampLabel: "10:41 AM",
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

/** --- Chat conversation (thread detail) --- */

export type ChatMessageSender = "peer" | "me";

export type ChatMessageKind = "text" | "image";

export interface ChatMessage {
  id: string;
  sender: ChatMessageSender;
  kind: ChatMessageKind;
  /** Body for text; caption optional for image */
  body?: string;
  imageUrl?: string;
  /** Shown under bubble when meta row visible, e.g. "10:32 AM" */
  timeLabel: string;
  /** Minutes from midnight for grouping (0–1440) */
  minuteOfDay: number;
  /** When set, a ❤️-style badge overlaps the bottom-left of this bubble */
  reactionBadge?: string;
}

const COFFEE_IMG =
  "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&q=80&auto=format&fit=crop";

/** Full Maya ↔ you demo thread */
export const mayaConversation: ChatMessage[] = [
  {
    id: "m1",
    sender: "peer",
    kind: "text",
    body: "Hey! Where are you from?",
    timeLabel: "10:32 AM",
    minuteOfDay: 10 * 60 + 32,
  },
  {
    id: "m2",
    sender: "me",
    kind: "text",
    body: "Hey! I'm from Toronto 🇨🇦 What about you?",
    timeLabel: "10:33 AM",
    minuteOfDay: 10 * 60 + 33,
  },
  {
    id: "m3",
    sender: "peer",
    kind: "text",
    body: "Nice! I'm from Vancouver 😊 How's the weather there?",
    timeLabel: "10:34 AM",
    minuteOfDay: 10 * 60 + 34,
  },
  {
    id: "m4",
    sender: "me",
    kind: "text",
    body: "It's been sunny and warm ☀️ Perfect for coffee shop hopping!",
    timeLabel: "10:35 AM",
    minuteOfDay: 10 * 60 + 35,
  },
  {
    id: "m5",
    sender: "peer",
    kind: "text",
    body: "That sounds amazing. Any favorite spots?",
    timeLabel: "10:36 AM",
    minuteOfDay: 10 * 60 + 36,
  },
  {
    id: "m6",
    sender: "me",
    kind: "text",
    body: "There's this tiny place downtown with the best lattes ☕ I'll send you a pic!",
    timeLabel: "10:39 AM",
    minuteOfDay: 10 * 60 + 39,
  },
  {
    id: "m7",
    sender: "me",
    kind: "image",
    imageUrl: COFFEE_IMG,
    timeLabel: "10:39 AM",
    minuteOfDay: 10 * 60 + 39 + 0.1,
    reactionBadge: "❤️",
  },
  {
    id: "m8",
    sender: "peer",
    kind: "text",
    body: "Looks lovely! 😍 We should check it out sometime.",
    timeLabel: "10:40 AM",
    minuteOfDay: 10 * 60 + 40,
  },
  {
    id: "m9",
    sender: "me",
    kind: "text",
    body: "Yes! Let's plan it this weekend?",
    timeLabel: "10:41 AM",
    minuteOfDay: 10 * 60 + 41,
  },
];

function shortThread(peerName: string): ChatMessage[] {
  return [
    {
      id: "g1",
      sender: "peer",
      kind: "text",
      body: `Hey — it's ${peerName}. Say hi anytime 👋`,
      timeLabel: "9:12 AM",
      minuteOfDay: 9 * 60 + 12,
    },
  ];
}

/** Keyed by chat id (matches `MessageThread.id` and profile ids where possible). */
export const messagesById: Record<string, ChatMessage[]> = {
  maya: mayaConversation,
  elena: shortThread("Elena"),
  sophie: shortThread("Sophie"),
  julia: shortThread("Julia"),
  nina: shortThread("Nina"),
};

export function getSeedMessages(chatId: string): ChatMessage[] {
  return messagesById[chatId] ?? [
    {
      id: "x1",
      sender: "peer",
      kind: "text",
      body: "Start the conversation — say hi!",
      timeLabel: "Now",
      minuteOfDay: 12 * 60,
    },
  ];
}

export function getThreadMeta(chatId: string): {
  name: string;
  avatarUrl: string;
  verified: boolean;
  onlineNow: boolean;
} {
  const row = messageThreads.find((t) => t.id === chatId);
  return {
    name: row?.name ?? chatId.charAt(0).toUpperCase() + chatId.slice(1),
    avatarUrl:
      row?.avatarUrl ??
      "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=200&q=80&auto=format&fit=crop",
    verified: row?.verified ?? false,
    onlineNow: row?.onlineNow ?? false,
  };
}
