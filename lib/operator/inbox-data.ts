import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatMessageRow, ChatProfileRow } from "@/lib/chat/map-rows";
import { encodeConversationId } from "@/lib/operator/conversation-key";
import type { OperatorQueueRow } from "@/lib/operator/queue";

export type OperatorInboxItem = {
  conversationId: string;
  ownerUserId: string;
  peerId: string;
  peerDisplayName: string;
  peerAvatarUrl: string;
  userEmail: string | null;
  lastMessagePreview: string | null;
  lastUserMessageAt: string | null;
  unreadForOperator: boolean;
  assignedOperatorId: string | null;
  priority: number;
  status: string;
  needsOperatorReply: boolean;
};

export async function loadOperatorInbox(
  supabase: SupabaseClient,
  opts?: { status?: string; limit?: number },
): Promise<OperatorInboxItem[]> {
  const limit = opts?.limit ?? 100;
  let q = supabase
    .from("chat_operator_queue")
    .select("*")
    .order("priority", { ascending: false })
    .order("last_user_message_at", { ascending: true, nullsFirst: false })
    .limit(limit);

  if (opts?.status) {
    q = q.eq("operator_status", opts.status);
  } else {
    q = q.or(
      "needs_operator_reply.eq.true,operator_status.eq.waiting_operator",
    );
  }

  const { data: rows, error } = await q;
  if (error) throw new Error(error.message);
  const queue = (rows ?? []) as OperatorQueueRow[];
  if (!queue.length) return [];

  const peerIds = Array.from(new Set(queue.map((r) => r.peer_id)));
  const ownerIds = Array.from(new Set(queue.map((r) => r.owner_user_id)));

  const { data: profiles } = await supabase
    .from("chat_profiles")
    .select("id, display_name, avatar_url, is_ai")
    .in("id", peerIds);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id as string, p as ChatProfileRow]),
  );

  const emails = new Map<string, string | null>();
  for (const oid of ownerIds) {
    const { data: authData } = await supabase.auth.admin.getUserById(oid);
    emails.set(oid, authData?.user?.email ?? null);
  }

  return queue.map((row) => {
    const peer = profileMap.get(row.peer_id);
    return {
      conversationId: encodeConversationId(row.owner_user_id, row.peer_id),
      ownerUserId: row.owner_user_id,
      peerId: row.peer_id,
      peerDisplayName: peer?.display_name ?? "Onbekend",
      peerAvatarUrl: peer?.avatar_url ?? "",
      userEmail: emails.get(row.owner_user_id) ?? null,
      lastMessagePreview: row.last_message_preview,
      lastUserMessageAt: row.last_user_message_at,
      unreadForOperator: row.unread_for_operator,
      assignedOperatorId: row.assigned_operator_id,
      priority: row.priority,
      status: row.operator_status,
      needsOperatorReply: row.needs_operator_reply,
    };
  });
}

export type OperatorThreadDetail = {
  conversationId: string;
  ownerUserId: string;
  peerId: string;
  peer: ChatProfileRow;
  ownerEmail: string | null;
  messages: ChatMessageRow[];
  queue: OperatorQueueRow | null;
  memorySummary: string | null;
};

export async function loadOperatorThreadDetail(
  supabase: SupabaseClient,
  ownerUserId: string,
  peerId: string,
): Promise<OperatorThreadDetail | null> {
  const { data: peer, error: pe } = await supabase
    .from("chat_profiles")
    .select("*")
    .eq("id", peerId)
    .maybeSingle();
  if (pe || !peer) return null;

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .eq("peer_id", peerId)
    .order("created_at", { ascending: true });

  const { data: queue } = await supabase
    .from("chat_operator_queue")
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .eq("peer_id", peerId)
    .maybeSingle();

  const { data: mem } = await supabase
    .from("chat_ai_thread_memory")
    .select("summary")
    .eq("owner_user_id", ownerUserId)
    .eq("peer_id", peerId)
    .maybeSingle();

  const { data: authData } = await supabase.auth.admin.getUserById(ownerUserId);

  return {
    conversationId: encodeConversationId(ownerUserId, peerId),
    ownerUserId,
    peerId,
    peer: peer as ChatProfileRow,
    ownerEmail: authData?.user?.email ?? null,
    messages: (messages ?? []) as ChatMessageRow[],
    queue: (queue as OperatorQueueRow | null) ?? null,
    memorySummary:
      mem && typeof (mem as { summary?: string }).summary === "string"
        ? (mem as { summary: string }).summary
        : null,
  };
}
