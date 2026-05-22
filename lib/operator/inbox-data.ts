import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatMessageRow, ChatProfileRow } from "@/lib/chat/map-rows";
import { encodeConversationId } from "@/lib/operator/conversation-key";
import type { OperatorQueueRow } from "@/lib/operator/queue";

export type OwnerProfileSnippet = {
  displayName: string;
  photoUrl: string;
  age: number | null;
  location: string;
};

export async function loadOwnerProfileSnippets(
  supabase: SupabaseClient,
  ownerUserIds: string[],
): Promise<Map<string, OwnerProfileSnippet>> {
  const map = new Map<string, OwnerProfileSnippet>();
  if (!ownerUserIds.length) return map;

  const { data: rows } = await supabase
    .from("user_profiles")
    .select("user_id, first_name, main_photo_url, age, location")
    .in("user_id", ownerUserIds);

  for (const row of rows ?? []) {
    const uid = row.user_id as string;
    const first = (row.first_name as string)?.trim();
    const ageRaw = row.age as number | null;
    map.set(uid, {
      displayName: first || "Gebruiker",
      photoUrl: (row.main_photo_url as string)?.trim() || "",
      age: typeof ageRaw === "number" && ageRaw > 0 ? ageRaw : null,
      location: (row.location as string)?.trim() || "",
    });
  }

  for (const oid of ownerUserIds) {
    if (map.has(oid)) continue;
    const { data: authData } = await supabase.auth.admin.getUserById(oid);
    const email = authData?.user?.email ?? "";
    const name = email ? email.split("@")[0] : "Gebruiker";
    map.set(oid, {
      displayName: name,
      photoUrl: "",
      age: null,
      location: "",
    });
  }

  return map;
}

export type OperatorInboxItem = {
  conversationId: string;
  ownerUserId: string;
  peerId: string;
  peerDisplayName: string;
  peerAvatarUrl: string;
  ownerDisplayName: string;
  ownerPhotoUrl: string;
  ownerAge: number | null;
  ownerLocation: string;
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
    .order("last_user_message_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (opts?.status) {
    q = q.eq("operator_status", opts.status);
  } else {
    // Keep answered threads visible; only hide explicitly closed/archived.
    q = q.not("operator_status", "in", "(closed,archived)");
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

  const ownerProfiles = await loadOwnerProfileSnippets(supabase, ownerIds);

  return queue.map((row) => {
    const peer = profileMap.get(row.peer_id);
    const owner = ownerProfiles.get(row.owner_user_id);
    return {
      conversationId: encodeConversationId(row.owner_user_id, row.peer_id),
      ownerUserId: row.owner_user_id,
      peerId: row.peer_id,
      peerDisplayName: peer?.display_name ?? "Onbekend",
      peerAvatarUrl: peer?.avatar_url ?? "",
      ownerDisplayName: owner?.displayName ?? "Gebruiker",
      ownerPhotoUrl: owner?.photoUrl ?? "",
      ownerAge: owner?.age ?? null,
      ownerLocation: owner?.location ?? "",
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
  ownerDisplayName: string;
  ownerPhotoUrl: string;
  ownerAge: number | null;
  ownerLocation: string;
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
  const ownerProfiles = await loadOwnerProfileSnippets(supabase, [ownerUserId]);
  const owner = ownerProfiles.get(ownerUserId);

  return {
    conversationId: encodeConversationId(ownerUserId, peerId),
    ownerUserId,
    peerId,
    peer: peer as ChatProfileRow,
    ownerEmail: authData?.user?.email ?? null,
    ownerDisplayName: owner?.displayName ?? "Gebruiker",
    ownerPhotoUrl: owner?.photoUrl ?? "",
    ownerAge: owner?.age ?? null,
    ownerLocation: owner?.location ?? "",
    messages: (messages ?? []) as ChatMessageRow[],
    queue: (queue as OperatorQueueRow | null) ?? null,
    memorySummary:
      mem && typeof (mem as { summary?: string }).summary === "string"
        ? (mem as { summary: string }).summary
        : null,
  };
}

/** All chat threads for one user (every persona they messaged). */
export type OperatorUserThreadItem = {
  conversationId: string;
  peerId: string;
  peerDisplayName: string;
  peerAvatarUrl: string;
  lastMessagePreview: string | null;
  lastActivityAt: string | null;
  needsOperatorReply: boolean;
  operatorStatus: string | null;
};

export async function loadOperatorUserThreads(
  supabase: SupabaseClient,
  ownerUserId: string,
): Promise<OperatorUserThreadItem[]> {
  const { data: messages, error: msgErr } = await supabase
    .from("chat_messages")
    .select("peer_id, body, sender, kind, created_at")
    .eq("owner_user_id", ownerUserId)
    .order("created_at", { ascending: false })
    .limit(800);

  if (msgErr) throw new Error(msgErr.message);

  const latestByPeer = new Map<
    string,
    {
      preview: string;
      at: string;
    }
  >();
  for (const row of messages ?? []) {
    const peerId = row.peer_id as string;
    if (!peerId || latestByPeer.has(peerId)) continue;
    const body = (row.body as string | null)?.trim();
    const kind = row.kind as string | undefined;
    const preview =
      body ||
      (kind === "image" ? "[afbeelding]" : kind === "gift" ? "[gift]" : "—");
    latestByPeer.set(peerId, {
      preview,
      at: row.created_at as string,
    });
  }

  const peerIds = Array.from(latestByPeer.keys());
  if (!peerIds.length) return [];

  const { data: profiles } = await supabase
    .from("chat_profiles")
    .select("id, display_name, avatar_url, is_ai")
    .in("id", peerIds);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id as string, p as ChatProfileRow]),
  );

  const { data: queueRows } = await supabase
    .from("chat_operator_queue")
    .select("peer_id, needs_operator_reply, operator_status")
    .eq("owner_user_id", ownerUserId);

  const queueMap = new Map(
    (queueRows ?? []).map((q) => [
      q.peer_id as string,
      q as {
        needs_operator_reply: boolean;
        operator_status: string;
      },
    ]),
  );

  const items: OperatorUserThreadItem[] = [];
  for (const peerId of peerIds) {
    const peer = profileMap.get(peerId);
    if (peer && peer.is_ai === false) continue;
    const latest = latestByPeer.get(peerId)!;
    const queue = queueMap.get(peerId);
    items.push({
      conversationId: encodeConversationId(ownerUserId, peerId),
      peerId,
      peerDisplayName: peer?.display_name ?? "Onbekend",
      peerAvatarUrl: peer?.avatar_url ?? "",
      lastMessagePreview: latest.preview,
      lastActivityAt: latest.at,
      needsOperatorReply: queue?.needs_operator_reply ?? false,
      operatorStatus: queue?.operator_status ?? null,
    });
  }

  items.sort((a, b) => {
    const ta = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
    const tb = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
    return tb - ta;
  });

  return items;
}
