export type ChatFilterId =
  | "links"
  | "active"
  | "replies"
  | "online"
  | "more";

export type MessagePreviewType =
  | "text"
  | "photo"
  | "voice"
  | "reaction"
  | "typing"
  | "locked";

export interface MessageThread {
  id: string;
  name: string;
  avatarUrl: string;
  lastMessage: string;
  /** Shown top-right, e.g. 10:32, Yesterday, 2d ago */
  timestampLabel: string;
  /** Purple “Online now” line under preview (legacy / optional) */
  onlineNow?: boolean;
  /** Green dot on avatar */
  showOnlineDot?: boolean;
  verified?: boolean;
  unreadCount?: number;
  /** Legacy DB filter tags */
  filterTags?: ChatFilterId[];
  pinned?: boolean;
  messageType?: MessagePreviewType;
  /** They linked — waiting on your reply */
  linkedPending?: boolean;
  previewImage?: string;
  voiceDuration?: string;
  reactionEmoji?: string;
  /** ISO for sorting (newest first) */
  lastActivityAt: string;
}

const u = (id: string, w = 400) =>
  `https://images.unsplash.com/${id}?w=${w}&q=80&auto=format&fit=crop`;

const COFFEE_IMG =
  "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&q=80&auto=format&fit=crop";

export const messageThreads: MessageThread[] = [
  {
    id: "elena",
    name: "Elena",
    avatarUrl: u("photo-1524504388940-b1c1722653e1"),
    lastMessage: "typing…",
    timestampLabel: "now",
    onlineNow: true,
    showOnlineDot: true,
    verified: true,
    unreadCount: 1,
    filterTags: ["links", "active", "online"],
    messageType: "typing",
    lastActivityAt: "2026-05-04T18:42:00.000Z",
  },
  {
    id: "maya",
    name: "Maya",
    avatarUrl: u("photo-1534528741775-53994a69daeb"),
    lastMessage: "Sent a photo",
    timestampLabel: "10:41 AM",
    onlineNow: true,
    showOnlineDot: true,
    verified: true,
    unreadCount: 1,
    filterTags: ["links", "active", "replies", "online"],
    messageType: "photo",
    previewImage: COFFEE_IMG,
    lastActivityAt: "2026-05-04T18:40:12.000Z",
  },
  {
    id: "marcus",
    name: "Marcus",
    avatarUrl: u("photo-1506794778202-cad84cf45f1d"),
    lastMessage: "Reacted to your message",
    timestampLabel: "10:22 AM",
    showOnlineDot: true,
    verified: false,
    messageType: "reaction",
    reactionEmoji: "❤️",
    lastActivityAt: "2026-05-04T18:22:00.000Z",
  },
  {
    id: "quinn",
    name: "River",
    avatarUrl: u("photo-1517841905240-472988babdf9"),
    lastMessage: "Link to see their message",
    timestampLabel: "9:58 AM",
    unreadCount: 1,
    filterTags: ["replies"],
    messageType: "locked",
    previewImage: COFFEE_IMG,
    lastActivityAt: "2026-05-04T17:58:00.000Z",
  },
  {
    id: "victoria",
    name: "Victoria",
    avatarUrl: u("photo-1529626455594-4ff0802cfb7e"),
    lastMessage: "Voice message",
    timestampLabel: "9:45 AM",
    showOnlineDot: true,
    verified: true,
    pinned: true,
    messageType: "voice",
    voiceDuration: "0:24",
    lastActivityAt: "2026-05-04T17:45:00.000Z",
  },
  {
    id: "oliver",
    name: "Oliver",
    avatarUrl: u("photo-1472099645785-5658abf4ff4e"),
    lastMessage: "Sent a photo",
    timestampLabel: "Yesterday",
    messageType: "photo",
    previewImage: u("photo-1546069901-ba9599a7e63c"),
    lastActivityAt: "2026-05-03T21:10:00.000Z",
  },
  {
    id: "clara",
    name: "Clara",
    avatarUrl: u("photo-1524504388940-b1c1722653e1"),
    lastMessage: "Books, tea, and honest convos — want to compare notes?",
    timestampLabel: "Yesterday",
    showOnlineDot: true,
    unreadCount: 1,
    messageType: "text",
    lastActivityAt: "2026-05-03T19:30:00.000Z",
  },
  {
    id: "sophie",
    name: "Sophie",
    avatarUrl: u("photo-1544005313-94ddf0286df2"),
    lastMessage: "Thanks for the chat!",
    timestampLabel: "Yesterday",
    showOnlineDot: true,
    filterTags: ["links", "online"],
    messageType: "text",
    lastActivityAt: "2026-05-03T16:00:00.000Z",
  },
  {
    id: "thomas",
    name: "Thomas",
    avatarUrl: u("photo-1507003211169-0a1dd7228f2d"),
    lastMessage: "Film nerd · always down to chat 🎬",
    timestampLabel: "Yesterday",
    linkedPending: true,
    messageType: "text",
    lastActivityAt: "2026-05-03T14:20:00.000Z",
  },
  {
    id: "lena",
    name: "Lena",
    avatarUrl: u("photo-1494790108377-be9c29b29330"),
    lastMessage: "Hey! I loved your profile ✨",
    timestampLabel: "2d ago",
    linkedPending: true,
    messageType: "text",
    lastActivityAt: "2026-05-02T11:00:00.000Z",
  },
  {
    id: "julia",
    name: "Julia",
    avatarUrl: u("photo-1517841905240-472988babdf9"),
    lastMessage: "It was nice talking to you",
    timestampLabel: "2d ago",
    filterTags: ["more"],
    messageType: "text",
    lastActivityAt: "2026-05-02T09:15:00.000Z",
  },
  {
    id: "nina",
    name: "Nina",
    avatarUrl: u("photo-1531746020798-e6953c6e8e04"),
    lastMessage: "Hey, how's your day?",
    timestampLabel: "2d ago",
    filterTags: ["more"],
    messageType: "text",
    lastActivityAt: "2026-05-02T08:00:00.000Z",
  },
];

export function sortThreadsByRecency(threads: MessageThread[]): MessageThread[] {
  return [...threads].sort(
    (a, b) =>
      new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime(),
  );
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
  marcus: shortThread("Marcus"),
  sophie: shortThread("Sophie"),
  julia: shortThread("Julia"),
  nina: shortThread("Nina"),
  quinn: shortThread("River"),
  thomas: shortThread("Thomas"),
  oliver: shortThread("Oliver"),
  victoria: shortThread("Victoria"),
  clara: shortThread("Clara"),
  lena: shortThread("Lena"),
  iris: shortThread("Iris"),
  zoe: shortThread("Zoe"),
};

/** Always empty — real history lives in Supabase per user; no demo transcripts. */
export function getSeedMessages(_chatId: string): ChatMessage[] {
  return [];
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
