import type {
  ChatFilterId,
  ChatMessage,
  ChatMessageSender,
  MessageThread,
} from "@/data/messages";

/** Optional structured persona styling metadata (DB column `chat_style`, jsonb).
 * Every key is optional; missing keys must fall back gracefully. Never surface
 * any of this verbatim in chat — only let it influence tone/style. */
export type ChatStyle = {
  /** Words/phrases the persona naturally drops in chat (e.g. "joh", "ofzo"). */
  verbal_tics?: string[];
  /** Tiny preferred emoji set (~2–5). Empty/missing means "use default sparingly". */
  emoji_palette?: string[];
  /** Typical reply rhythm. */
  reply_length?: "short" | "medium" | "variable";
  /** Casual = drops dots, sometimes lowercase. Clean = polished punctuation. */
  punctuation?: "casual" | "clean";
  /** Idiosyncratic small quirks ("luistert dezelfde 4 nummers tot ze ze haat"). */
  quirks?: string[];
  /** Subjects the persona prefers to keep light / not unpack early. */
  talks_less_about?: string[];
};

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
  city?: string | null;
  gallery_urls?: string[] | null;
  interests?: unknown;
  looking_for?: string | null;
  last_active_label?: string | null;
  status_variant?: string | null;
  status_label?: string | null;
  joined_at?: string | null;
  home_sort?: number | null;
  /** Funnel step-3 vibe ids; subset of `FUNNEL_VIBES` in `data/funnel.ts`. */
  vibe_tags?: string[] | null;
  /** Funnel step-2 intent ids; subset of `FUNNEL_LOOKING_FOR` in `data/funnel.ts`. */
  funnel_intent_ids?: string[] | null;
  /** Optional persona texture (verbal tics, emoji, reply length, quirks). */
  chat_style?: ChatStyle | null;
  /** Optional structured photo style; see lib/images/persona-photo-prompt.ts. */
  photo_style?: Record<string, unknown> | null;
  /** Concrete profession in Dutch, e.g. "planner bij een marketingbureau". */
  occupation?: string | null;
  /** Multi-paragraph interior-life description for the AI prompt. */
  backstory?: string | null;
  /** JSONB bag: languages, personality_traits, daily_rhythm, goals, pet_names,
   * relationship_hint, timezone, voice_style. All keys optional. */
  persona_meta?: PersonaMeta | null;
  /** Admin soft-hide. */
  is_archived?: boolean | null;
};

/** Long-tail persona attributes the chat-prompt builder reads. Everything
 * is optional; missing keys collapse to defaults in the prompt. */
export type PersonaMeta = {
  /** ISO 639-1 codes she'd actually speak in chat (typically just "nl"). */
  languages?: string[];
  /** Adjective list driving consistent reactions: "empatisch", "stug over
   * eten", "nieuwsgierig zonder te willen veranderen". */
  personality_traits?: string[];
  /** Free-form rhythm description used to ground "wat doe je nu" answers. */
  daily_rhythm?: string;
  /** Short sentences about what she's working towards (career, life, body). */
  goals?: string[];
  /** Pet-names she'd naturally use for him as the relationship deepens. */
  pet_names?: string[];
  /** One paragraph for when chat turns serious about exes/long-term. */
  relationship_hint?: string;
  /** IANA timezone override; if absent, falls back to PERSONA_DEFAULT_TZ. */
  timezone?: string;
  /** "Kort en speels", "lange gedachtes", etc. — overflow from chat_style. */
  voice_style?: string;
};

export type ChatMessageRow = {
  id: string;
  peer_id: string;
  sender: string;
  kind: string;
  body: string | null;
  image_url: string | null;
  reaction_emoji: string | null;
  gift_credits: number | null;
  created_at: string;
  /** Timestamp at which the AI peer "saw" this user message. Powers the
   * "Read at HH:MM" indicator. NULL until she's processed the message. */
  peer_read_at?: string | null;
};

export function isoToThreadTimeLabel(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "Nu";
  if (diff < 86_400_000) {
    return d.toLocaleTimeString("nl-NL", {
      hour: "numeric",
      minute: "2-digit",
      hour12: false,
    });
  }
  if (diff < 172_800_000) return "Gisteren";
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)} d geleden`;
  return d.toLocaleDateString("nl-NL");
}

export function profileRowToThread(row: ChatProfileRow): MessageThread {
  const tags = (row.filter_tags ?? []) as ChatFilterId[];
  return {
    id: row.id,
    name: row.display_name,
    avatarUrl: row.avatar_url,
    lastMessage: row.last_message_preview ?? "Zeg hallo! 👋",
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

/** Build list preview from the latest message the user has with this peer (real chats). */
export function mergeProfileWithLatestUserMessage(
  row: ChatProfileRow,
  latest: Pick<
    ChatMessageRow,
    "body" | "created_at" | "kind" | "image_url" | "reaction_emoji" | "sender"
  > & { gift_credits?: number | null },
): MessageThread {
  const base = profileRowToThread(row);
  const ts = isoToThreadTimeLabel(latest.created_at);
  const at = latest.created_at;
  const latestSender: "me" | "peer" =
    latest.sender === "me" ? "me" : "peer";

  if (latest.kind === "image") {
    return {
      ...base,
      lastMessage: "Foto",
      messageType: "photo",
      previewImage: latest.image_url ?? undefined,
      timestampLabel: ts,
      lastActivityAt: at,
      latestSender,
    };
  }

  if (latest.kind === "gift") {
    const amount = latest.gift_credits ?? 0;
    return {
      ...base,
      messageType: "text",
      lastMessage: amount > 0 ? `🎁 ${amount} credits` : "🎁 Cadeau verstuurd",
      timestampLabel: ts,
      lastActivityAt: at,
      latestSender,
    };
  }

  if (latest.reaction_emoji) {
    return {
      ...base,
      messageType: "reaction",
      reactionEmoji: latest.reaction_emoji,
      lastMessage: "Reageerde op je bericht",
      timestampLabel: ts,
      lastActivityAt: at,
      latestSender,
    };
  }

  return {
    ...base,
    messageType: "text",
    lastMessage: (latest.body ?? "").trim() || "Bericht",
    timestampLabel: ts,
    lastActivityAt: at,
    latestSender,
  };
}

export function messageRowToUi(row: ChatMessageRow): ChatMessage {
  const d = new Date(row.created_at);
  const timeLabel = d.toLocaleTimeString("nl-NL", {
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  });
  const minuteOfDay =
    d.getHours() * 60 +
    d.getMinutes() +
    d.getSeconds() / 60 +
    d.getMilliseconds() / 60000;

  const sender: ChatMessageSender = row.sender === "me" ? "me" : "peer";
  const kind: ChatMessage["kind"] =
    row.kind === "image" ? "image" : row.kind === "gift" ? "gift" : "text";

  return {
    id: row.id,
    sender,
    kind,
    body: row.body ?? undefined,
    imageUrl: row.image_url ?? undefined,
    giftCredits:
      typeof row.gift_credits === "number" && row.gift_credits > 0
        ? row.gift_credits
        : undefined,
    timeLabel,
    minuteOfDay,
    reactionBadge: row.reaction_emoji ?? undefined,
    peerReadAt: row.peer_read_at ?? undefined,
  };
}
