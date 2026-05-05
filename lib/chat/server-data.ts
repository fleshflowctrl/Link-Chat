import { redirect } from "next/navigation";
import {
  getSeedMessages,
  getThreadMeta,
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
import { hasServerDevBypassCookie } from "@/lib/dev-bypass-server";
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
 * mock rail when Supabase is off / bypass / no matches (strip stays visible).
 */
export async function fetchMessagesOnlineRailServer(): Promise<OnlineUser[]> {
  const mockRail = () => getOnlineUsers();

  if (hasServerDevBypassCookie() || !isSupabaseConfigured()) {
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
 * Threads for the signed-in user: one row per peer they have actually messaged.
 * Never injects demo threads — new users see an empty list until they send a message.
 */
export async function fetchThreadListServer(): Promise<MessageThread[]> {
  if (hasServerDevBypassCookie() || !isSupabaseConfigured()) {
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
      .select("peer_id, body, created_at, kind, image_url, reaction_emoji")
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
        "body" | "created_at" | "kind" | "image_url" | "reaction_emoji"
      >
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

    return peerOrder
      .map((id) => {
        const row = byId.get(id);
        const latest = latestByPeer.get(id);
        if (!row || !latest) return null;
        return mergeProfileWithLatestUserMessage(row, latest);
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
  if (hasServerDevBypassCookie()) {
    return {
      messages: getSeedMessages(peerId),
      meta: getThreadMeta(peerId),
      useSupabase: false,
    };
  }

  if (!isSupabaseConfigured()) {
    return {
      messages: getSeedMessages(peerId),
      meta: getThreadMeta(peerId),
      useSupabase: false,
    };
  }

  let supabase: ReturnType<typeof createClient>;
  try {
    supabase = createClient();
  } catch {
    return {
      messages: getSeedMessages(peerId),
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
