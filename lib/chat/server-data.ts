import { redirect } from "next/navigation";
import {
  getSeedMessages,
  getThreadMeta,
  messageThreads,
  type ChatMessage,
  type MessageThread,
} from "@/data/messages";
import {
  isoToThreadTimeLabel,
  messageRowToUi,
  profileRowToThread,
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

export async function fetchThreadListServer(): Promise<MessageThread[]> {
  if (!isSupabaseConfigured()) {
    return messageThreads;
  }

  let supabase: ReturnType<typeof createClient>;
  try {
    supabase = createClient();
  } catch (e) {
    console.error("[fetchThreadListServer] createClient", e);
    return messageThreads;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  try {
    const { data: profiles, error: pe } = await supabase
      .from("chat_profiles")
      .select("*")
      .order("display_name", { ascending: true });

    if (pe || !profiles?.length) return messageThreads;

    const profileRows = profiles as ChatProfileRow[];

    const { data: previews } = await supabase
      .from("chat_messages")
      .select("peer_id, body, created_at")
      .eq("owner_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(500);

    const latestByPeer = new Map<string, { body: string; created_at: string }>();
    for (const row of previews ?? []) {
      if (
        row.peer_id &&
        typeof row.body === "string" &&
        !latestByPeer.has(row.peer_id)
      ) {
        latestByPeer.set(row.peer_id, {
          body: row.body,
          created_at: row.created_at as string,
        });
      }
    }

    const decorated = profileRows.map((row) => ({
      row,
      sortAt:
        latestByPeer.get(row.id)?.created_at ??
        row.last_message_at ??
        "1970-01-01T00:00:00.000Z",
    }));
    decorated.sort(
      (a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime(),
    );

    return decorated.map(({ row }) => {
      const base = profileRowToThread(row);
      const hit = latestByPeer.get(row.id);
      if (!hit) return base;
      return {
        ...base,
        lastMessage: hit.body,
        timestampLabel: isoToThreadTimeLabel(hit.created_at),
      };
    });
  } catch (e) {
    console.error("[fetchThreadListServer]", e);
    return messageThreads;
  }
}

export async function fetchConversationServer(peerId: string): Promise<{
  messages: ChatMessage[];
  meta: ThreadMeta;
  useSupabase: boolean;
}> {
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
      messages: getSeedMessages(peerId),
      meta: fallbackMeta,
      useSupabase: false,
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
