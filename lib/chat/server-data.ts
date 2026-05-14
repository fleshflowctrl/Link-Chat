import { redirect } from "next/navigation";
import {
  getThreadMeta,
  messagesById,
  type ChatMessage,
  type MessageThread,
} from "@/data/messages";
import { getOnlineUsers, type OnlineUser } from "@/data/onlineUsers";
import {
  mergeProfileWithLatestUserMessage,
  messageRowToUi,
  type ChatMessageRow,
  type ChatProfileRow,
} from "@/lib/chat/map-rows";
import { createClient } from "@/utils/supabase/server";
import { isSupabaseConfigured } from "@/utils/supabase/public-env";

export type ThreadMeta = {
  name: string;
  avatarUrl: string;
  verified: boolean;
  onlineNow: boolean;
};

export type ConversationPageData = {
  messages: ChatMessage[];
  meta: ThreadMeta;
  useSupabase: boolean;
  /** Valid peer missing from catalog — show 404. */
  notFound?: boolean;
};

/**
 * “Online now” on Messages — catalog personas with `online_now`, same as home’s
 * mock rail when Supabase is off or query has no matches (strip stays visible).
 */
export async function fetchMessagesOnlineRailServer(): Promise<OnlineUser[]> {
  const mockRail = () => getOnlineUsers();

  if (!isSupabaseConfigured()) {
    return mockRail();
  }

  let supabase: ReturnType<typeof createClient>;
  try {
    supabase = createClient();
  } catch {
    return mockRail();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rows, error } = await supabase
    .from("chat_profiles")
    .select("id, display_name, avatar_url, online_now")
    .eq("online_now", true)
    .order("display_name", { ascending: true })
    .limit(24);

  if (error || !rows?.length) {
    return mockRail();
  }

  return rows.map((r) => ({
    id: r.id as string,
    name: r.display_name as string,
    avatar: r.avatar_url as string,
    isOnline: true,
  }));
}

/**
 * Number of inbox threads with unread peer messages for the signed-in user.
 *
 * A thread is unread iff its most recent message is from the peer AND that
 * message is newer than the user's `chat_reads.last_read_at` for that peer
 * (or no read row exists yet).
 *
 * This is the SSR baseline for the bottom-nav red dot; clients also poll
 * `/api/me/unread-count` to keep it fresh between navigations.
 */
export async function fetchUnreadInboxCountServer(): Promise<number> {
  if (!isSupabaseConfigured()) return 0;

  let supabase: ReturnType<typeof createClient>;
  try {
    supabase = createClient();
  } catch {
    return 0;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data: rows, error } = await supabase
    .from("chat_messages")
    .select("peer_id, sender, created_at")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: false });

  if (error || !rows?.length) return 0;

  const latestPeerByPeer = new Map<string, string>();
  const seen = new Set<string>();
  for (const r of rows) {
    const pid = r.peer_id as string;
    if (seen.has(pid)) continue;
    seen.add(pid);
    if ((r.sender as string) === "peer") {
      latestPeerByPeer.set(pid, r.created_at as string);
    }
  }

  if (latestPeerByPeer.size === 0) return 0;

  const peerIds = Array.from(latestPeerByPeer.keys());
  const { data: reads } = await supabase
    .from("chat_reads")
    .select("peer_id, last_read_at")
    .eq("owner_user_id", user.id)
    .in("peer_id", peerIds);

  const lastReadByPeer = new Map<string, string>();
  for (const r of reads ?? []) {
    lastReadByPeer.set(r.peer_id as string, r.last_read_at as string);
  }

  let unread = 0;
  latestPeerByPeer.forEach((latestAt, pid) => {
    const readAt = lastReadByPeer.get(pid);
    if (!readAt || new Date(readAt).getTime() < new Date(latestAt).getTime()) {
      unread += 1;
    }
  });
  return unread;
}

/**
 * Threads for the signed-in user: one row per peer they have actually messaged.
 * Never injects demo threads — new users see an empty list until they send a message.
 */
export async function fetchThreadListServer(): Promise<MessageThread[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  let supabase: ReturnType<typeof createClient>;
  try {
    supabase = createClient();
  } catch (e) {
    console.error("[fetchThreadListServer] createClient", e);
    return [];
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  try {
    const { data: allMsgs, error: me } = await supabase
      .from("chat_messages")
      .select(
        "peer_id, body, created_at, kind, image_url, reaction_emoji, gift_credits, sender",
      )
      .eq("owner_user_id", user.id)
      .order("created_at", { ascending: false });

    if (me) {
      console.error("[fetchThreadListServer] messages", me);
      return [];
    }

    const latestByPeer = new Map<
      string,
      Pick<
        ChatMessageRow,
        "body" | "created_at" | "kind" | "image_url" | "reaction_emoji" | "sender"
      > & { gift_credits: number | null }
    >();
    const peerOrder: string[] = [];

    for (const row of allMsgs ?? []) {
      const pid = row.peer_id as string;
      if (!pid || latestByPeer.has(pid)) continue;
      latestByPeer.set(pid, {
        body: row.body as string | null,
        created_at: row.created_at as string,
        kind: (row.kind as string) || "text",
        image_url: row.image_url as string | null,
        reaction_emoji: row.reaction_emoji as string | null,
        gift_credits: (row as { gift_credits?: number | null }).gift_credits ?? null,
        sender: (row.sender as string) ?? "me",
      });
      peerOrder.push(pid);
    }

    if (peerOrder.length === 0) {
      return [];
    }

    const { data: profiles, error: pe } = await supabase
      .from("chat_profiles")
      .select("*")
      .in("id", peerOrder);

    if (pe || !profiles?.length) {
      console.error("[fetchThreadListServer] profiles", pe);
      return [];
    }

    const byId = new Map(
      (profiles as ChatProfileRow[]).map((p) => [p.id, p] as const),
    );

    // Per-peer last-read timestamps so each thread carries an authoritative
    // unreadCount (1 if latest peer message is newer than last read, else 0).
    const { data: reads } = await supabase
      .from("chat_reads")
      .select("peer_id, last_read_at")
      .eq("owner_user_id", user.id)
      .in("peer_id", peerOrder);

    const lastReadByPeer = new Map<string, string>();
    for (const r of reads ?? []) {
      lastReadByPeer.set(r.peer_id as string, r.last_read_at as string);
    }

    return peerOrder
      .map((id) => {
        const row = byId.get(id);
        const latest = latestByPeer.get(id);
        if (!row || !latest) return null;
        const thread = mergeProfileWithLatestUserMessage(row, latest);
        if (latest.sender === "peer") {
          const readAt = lastReadByPeer.get(id);
          const unread =
            !readAt ||
            new Date(readAt).getTime() < new Date(latest.created_at).getTime();
          thread.unreadCount = unread ? 1 : 0;
        } else {
          thread.unreadCount = 0;
        }
        return thread;
      })
      .filter((t): t is MessageThread => t != null);
  } catch (e) {
    console.error("[fetchThreadListServer]", e);
    return [];
  }
}

export async function fetchConversationServer(
  peerId: string,
): Promise<ConversationPageData> {
  if (!isSupabaseConfigured()) {
    return {
      messages: messagesById[peerId] ?? [],
      meta: getThreadMeta(peerId),
      useSupabase: false,
    };
  }

  let supabase: ReturnType<typeof createClient>;
  try {
    supabase = createClient();
  } catch {
    return {
      messages: messagesById[peerId] ?? [],
      meta: getThreadMeta(peerId),
      useSupabase: false,
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const fallbackMeta = getThreadMeta(peerId);

  const { data: profile, error: profileError } = await supabase
    .from("chat_profiles")
    .select("*")
    .eq("id", peerId)
    .maybeSingle();

  if (profileError || !profile) {
    return {
      messages: [],
      meta: fallbackMeta,
      useSupabase: true,
      notFound: true,
    };
  }

  const p = profile as ChatProfileRow;
  const meta: ThreadMeta = {
    name: p.display_name,
    avatarUrl: p.avatar_url,
    verified: p.verified,
    onlineNow: p.online_now,
  };

  const { data: msgs, error: msgError } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("peer_id", peerId)
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: true });

  if (msgError) {
    return {
      messages: [],
      meta,
      useSupabase: true,
    };
  }

  const list = (msgs ?? []) as ChatMessageRow[];

  return {
    messages: list.map(messageRowToUi),
    meta,
    useSupabase: true,
  };
}
