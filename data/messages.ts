import { getProfileById } from "@/data/profiles";

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
  /** Who sent the most recent message — used to derive unread state. */
  latestSender?: "me" | "peer";
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
    lastMessage: "typt…",
    timestampLabel: "nu",
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
    lastMessage: "Stuurde een foto",
    timestampLabel: "10:41",
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
    id: "femke",
    name: "Femke",
    avatarUrl: u("photo-1487412720507-e7ab37603c6f"),
    lastMessage: "Reageerde op je bericht",
    timestampLabel: "10:22",
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
    lastMessage: "Koppel om hun bericht te zien",
    timestampLabel: "9:58",
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
    lastMessage: "Spraakbericht",
    timestampLabel: "9:45",
    showOnlineDot: true,
    verified: true,
    pinned: true,
    messageType: "voice",
    voiceDuration: "0:24",
    lastActivityAt: "2026-05-04T17:45:00.000Z",
  },
  {
    id: "olivia",
    name: "Olivia",
    avatarUrl: u("photo-1573496359142-b8d87734a5a2"),
    lastMessage: "Stuurde een foto",
    timestampLabel: "Gisteren",
    messageType: "photo",
    previewImage: u("photo-1546069901-ba9599a7e63c"),
    lastActivityAt: "2026-05-03T21:10:00.000Z",
  },
  {
    id: "clara",
    name: "Clara",
    avatarUrl: u("photo-1524504388940-b1c1722653e1"),
    lastMessage: "Boeken, thee en eerlijke gesprekken — ideeën uitwisselen?",
    timestampLabel: "Gisteren",
    showOnlineDot: true,
    unreadCount: 1,
    messageType: "text",
    lastActivityAt: "2026-05-03T19:30:00.000Z",
  },
  {
    id: "sophie",
    name: "Sophie",
    avatarUrl: u("photo-1544005313-94ddf0286df2"),
    lastMessage: "Bedankt voor het gesprek!",
    timestampLabel: "Gisteren",
    showOnlineDot: true,
    filterTags: ["links", "online"],
    messageType: "text",
    lastActivityAt: "2026-05-03T16:00:00.000Z",
  },
  {
    id: "tara",
    name: "Tara",
    avatarUrl: u("photo-1580489944761-15a19d654956"),
    lastMessage: "Filmfanaat · altijd in voor een chat 🎬",
    timestampLabel: "Gisteren",
    linkedPending: true,
    messageType: "text",
    lastActivityAt: "2026-05-03T14:20:00.000Z",
  },
  {
    id: "lena",
    name: "Lena",
    avatarUrl: u("photo-1494790108377-be9c29b29330"),
    lastMessage: "Hé! Ik vond je profiel leuk ✨",
    timestampLabel: "2 d geleden",
    linkedPending: true,
    messageType: "text",
    lastActivityAt: "2026-05-02T11:00:00.000Z",
  },
  {
    id: "julia",
    name: "Julia",
    avatarUrl: u("photo-1517841905240-472988babdf9"),
    lastMessage: "Was leuk om met je te praten",
    timestampLabel: "2 d geleden",
    filterTags: ["more"],
    messageType: "text",
    lastActivityAt: "2026-05-02T09:15:00.000Z",
  },
  {
    id: "nina",
    name: "Nina",
    avatarUrl: u("photo-1531746020798-e6953c6e8e04"),
    lastMessage: "Hé, hoe is je dag?",
    timestampLabel: "2 d geleden",
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

export type ChatMessageKind = "text" | "image" | "gift";

export interface ChatMessage {
  id: string;
  sender: ChatMessageSender;
  kind: ChatMessageKind;
  /** Body for text; caption optional for image */
  body?: string;
  imageUrl?: string;
  /** When kind === "gift": the credits amount sent. */
  giftCredits?: number;
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
    body: "Hé! Waar kom je vandaan?",
    timeLabel: "10:32",
    minuteOfDay: 10 * 60 + 32,
  },
  {
    id: "m2",
    sender: "me",
    kind: "text",
    body: "Hé! Ik kom uit Amsterdam 🇳🇱 Jij?",
    timeLabel: "10:33",
    minuteOfDay: 10 * 60 + 33,
  },
  {
    id: "m3",
    sender: "peer",
    kind: "text",
    body: "Leuk! Ik woon in Utrecht 😊 Hoe is het weer bij jou?",
    timeLabel: "10:34",
    minuteOfDay: 10 * 60 + 34,
  },
  {
    id: "m4",
    sender: "me",
    kind: "text",
    body: "Zonnig en warm ☀️ Perfect om langs cafés te slenteren!",
    timeLabel: "10:35",
    minuteOfDay: 10 * 60 + 35,
  },
  {
    id: "m5",
    sender: "peer",
    kind: "text",
    body: "Klinkt top. Heb je favoriete plekken?",
    timeLabel: "10:36",
    minuteOfDay: 10 * 60 + 36,
  },
  {
    id: "m6",
    sender: "me",
    kind: "text",
    body: "Er is een klein plekje in het centrum met de beste latte’s ☕ Ik stuur je een foto!",
    timeLabel: "10:39",
    minuteOfDay: 10 * 60 + 39,
  },
  {
    id: "m7",
    sender: "me",
    kind: "image",
    imageUrl: COFFEE_IMG,
    timeLabel: "10:39",
    minuteOfDay: 10 * 60 + 39 + 0.1,
    reactionBadge: "❤️",
  },
  {
    id: "m8",
    sender: "peer",
    kind: "text",
    body: "Ziet er mooi uit! 😍 Eens langsgaan?",
    timeLabel: "10:40",
    minuteOfDay: 10 * 60 + 40,
  },
  {
    id: "m9",
    sender: "me",
    kind: "text",
    body: "Ja! Zullen we dit weekend afspreken?",
    timeLabel: "10:41",
    minuteOfDay: 10 * 60 + 41,
  },
];

function shortThread(peerName: string): ChatMessage[] {
  return [
    {
      id: "g1",
      sender: "peer",
      kind: "text",
    body: `Hé — ${peerName} hier. Zeg gerust hallo 👋`,
    timeLabel: "9:12",
      minuteOfDay: 9 * 60 + 12,
    },
  ];
}

/** Keyed by chat id (matches `MessageThread.id` and profile ids where possible). */
export const messagesById: Record<string, ChatMessage[]> = {
  maya: mayaConversation,
  elena: shortThread("Elena"),
  femke: shortThread("Femke"),
  sophie: shortThread("Sophie"),
  julia: shortThread("Julia"),
  nina: shortThread("Nina"),
  quinn: shortThread("River"),
  tara: shortThread("Tara"),
  olivia: shortThread("Olivia"),
  victoria: shortThread("Victoria"),
  clara: shortThread("Clara"),
  lena: shortThread("Lena"),
  iris: shortThread("Iris"),
  zoe: shortThread("Zoe"),
};

/**
 * Browser-only: append the user’s first onboarding message to the in-memory mock
 * thread (used when Supabase is off / demo inbox).
 */
export function appendOnboardingOutboundToMockThread(
  chatId: string,
  body: string,
): void {
  if (typeof window === "undefined") return;
  const trimmed = body.trim();
  if (!trimmed) return;
  const d = new Date();
  const timeLabel = d.toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  });
  const minuteOfDay = d.getHours() * 60 + d.getMinutes();
  const msg: ChatMessage = {
    id: `onboard-${d.getTime()}`,
    sender: "me",
    kind: "text",
    body: trimmed,
    timeLabel,
    minuteOfDay,
  };
  const prev = messagesById[chatId] ?? [];
  messagesById[chatId] = [...prev.filter((m) => !m.id.startsWith("onboard-")), msg];
}

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
  const profile = getProfileById(chatId);
  return {
    name:
      row?.name ??
      profile?.name ??
      chatId.charAt(0).toUpperCase() + chatId.slice(1),
    avatarUrl:
      row?.avatarUrl ??
      profile?.photo ??
      "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=200&q=80&auto=format&fit=crop",
    verified: row?.verified ?? profile?.isVerified ?? false,
    onlineNow: row?.onlineNow ?? profile?.status.variant === "online",
  };
}
