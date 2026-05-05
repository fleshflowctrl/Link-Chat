import type {
  ChatFilterId,
  ChatMessage,
  ChatMessageSender,
  MessageThread,
} from "@/data/messages";

export type ChatProfileRow = {
  id: string;
  display_name: string;
  avatar_url: string;
  verified: boolean;
  online_now: boolean;
  is_ai: boolean;
  bio: string;
  filter_tags: string[] | null;
  last_message_preview: string | null;
  last_message_at: string | null;
  age?: number | null;
  distance_km?: number | null;
  gallery_urls?: string[] | null;
  interests?: unknown;
  looking_for?: string | null;
  last_active_label?: string | null;
  status_variant?: string | null;
  status_label?: string | null;
  joined_at?: string | null;
  home_sort?: number | null;
};

export type ChatMessageRow = {
  id: string;
  peer_id: string;
  sender: string;
  kind: string;
  body: string | null;
  image_url: string | null;
  reaction_emoji: string | null;
  created_at: string;
};

export function isoToThreadTimeLabel(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "Now";
  if (diff < 86_400_000) {
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }
  if (diff < 172_800_000) return "Yesterday";
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return d.toLocaleDateString();
}

export function profileRowToThread(row: ChatProfileRow): MessageThread {
  const tags = (row.filter_tags ?? []) as ChatFilterId[];
  return {
    id: row.id,
    name: row.display_name,
    avatarUrl: row.avatar_url,
    lastMessage: row.last_message_preview ?? "Say hi! 👋",
    timestampLabel: isoToThreadTimeLabel(row.last_message_at),
    onlineNow: row.online_now,
    showOnlineDot: row.online_now,
    verified: row.verified,
    filterTags: tags.length ? tags : ["more"],
    pinned: false,
    messageType: "text",
    linkedPending: false,
    lastActivityAt: row.last_message_at ?? new Date().toISOString(),
  };
}

export function messageRowToUi(row: ChatMessageRow): ChatMessage {
  const d = new Date(row.created_at);
  const timeLabel = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const minuteOfDay =
    d.getHours() * 60 +
    d.getMinutes() +
    d.getSeconds() / 60 +
    d.getMilliseconds() / 60000;

  const sender: ChatMessageSender = row.sender === "me" ? "me" : "peer";
  const kind = row.kind === "image" ? "image" : "text";

  return {
    id: row.id,
    sender,
    kind,
    body: row.body ?? undefined,
    imageUrl: row.image_url ?? undefined,
    timeLabel,
    minuteOfDay,
    reactionBadge: row.reaction_emoji ?? undefined,
  };
}
