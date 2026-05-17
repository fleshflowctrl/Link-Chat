import type { SupabaseClient } from "@supabase/supabase-js";
import {
  messageRowToUi,
  type ChatMessageRow,
  type ChatProfileRow,
} from "@/lib/chat/map-rows";

type MessageSummaryRow = {
  owner_user_id: string;
  peer_id: string;
  body: string | null;
  kind: string;
  reaction_emoji: string | null;
  sender: string;
  created_at: string;
};

type ProfileRow = {
  id: string;
  display_name: string;
  avatar_url: string;
};

export type AdminChatUserSummary = {
  ownerUserId: string;
  ownerEmail: string | null;
  threadCount: number;
  messageCount: number;
  lastMessageAt: string;
  lastMessagePreview: string;
};

export type AdminThreadSummary = {
  ownerUserId: string;
  ownerEmail: string | null;
  peerId: string;
  peerName: string;
  peerAvatarUrl: string;
  messageCount: number;
  lastMessageAt: string;
  lastMessagePreview: string;
  lastSender: "me" | "peer";
};

export type AdminThreadMessage = ReturnType<typeof messageRowToUi> & {
  createdAt: string;
};

export type AdminThreadDetail = {
  ownerUserId: string;
  ownerEmail: string | null;
  peer: {
    id: string;
    name: string;
    avatarUrl: string;
  };
  messages: AdminThreadMessage[];
};

function previewFromMessage(m: MessageSummaryRow): string {
  if (m.kind === "image") return "Foto";
  if (m.reaction_emoji) return "Reactie";
  return (m.body ?? "").trim() || "Bericht";
}

/** Only messages the real user sent — not AI/bot replies. */
function isUserSentMessage(m: MessageSummaryRow): boolean {
  return m.sender === "me";
}

async function fetchMessageSummaries(
  service: SupabaseClient,
): Promise<MessageSummaryRow[]> {
  const { data, error } = await service
    .from("chat_messages")
    .select(
      "owner_user_id, peer_id, body, kind, reaction_emoji, sender, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as MessageSummaryRow[];
}

async function loadPeerProfiles(
  service: SupabaseClient,
  peerIds: string[],
): Promise<Map<string, ProfileRow>> {
  const peerById = new Map<string, ProfileRow>();
  if (peerIds.length === 0) return peerById;

  const { data: profs } = await service
    .from("chat_profiles")
    .select("id, display_name, avatar_url")
    .in("id", peerIds);

  for (const p of (profs ?? []) as ProfileRow[]) peerById.set(p.id, p);
  return peerById;
}

async function loadEmailsByUserId(
  service: SupabaseClient,
  userIds: string[],
): Promise<Map<string, string | null>> {
  const emailById = new Map<string, string | null>();
  const unique = Array.from(new Set(userIds));
  await Promise.all(
    unique.map(async (id) => {
      const { data } = await service.auth.admin.getUserById(id);
      emailById.set(id, data?.user?.email ?? null);
    }),
  );
  return emailById;
}

/** Users who sent at least one message, sorted by latest activity. */
export async function loadAdminChatUsers(
  service: SupabaseClient,
): Promise<AdminChatUserSummary[]> {
  const rows = await fetchMessageSummaries(service);
  const byOwner = new Map<
    string,
    { messageCount: number; peers: Set<string>; latest: MessageSummaryRow }
  >();

  for (const m of rows) {
    let entry = byOwner.get(m.owner_user_id);
    if (!entry) {
      entry = { messageCount: 0, peers: new Set(), latest: m };
      byOwner.set(m.owner_user_id, entry);
    }
    if (isUserSentMessage(m)) {
      entry.messageCount += 1;
      entry.peers.add(m.peer_id);
    }
  }

  const ownerIds = Array.from(byOwner.keys()).filter(
    (id) => (byOwner.get(id)?.messageCount ?? 0) > 0,
  );
  const emailById = await loadEmailsByUserId(service, ownerIds);

  return ownerIds
    .map((ownerUserId) => {
      const entry = byOwner.get(ownerUserId)!;
      return {
        ownerUserId,
        ownerEmail: emailById.get(ownerUserId) ?? null,
        threadCount: entry.peers.size,
        messageCount: entry.messageCount,
        lastMessageAt: entry.latest.created_at,
        lastMessagePreview: previewFromMessage(entry.latest),
      } satisfies AdminChatUserSummary;
    })
    .sort(
      (a, b) =>
        new Date(b.lastMessageAt).getTime() -
        new Date(a.lastMessageAt).getTime(),
    );
}

/** All conversations for one user, sorted by latest activity. */
export async function loadAdminUserThreads(
  service: SupabaseClient,
  ownerUserId: string,
): Promise<AdminThreadSummary[]> {
  const rows = (await fetchMessageSummaries(service)).filter(
    (m) => m.owner_user_id === ownerUserId,
  );

  const counts = new Map<string, number>();
  const latest = new Map<string, MessageSummaryRow>();
  for (const m of rows) {
    const key = m.peer_id;
    if (!latest.has(key)) latest.set(key, m);
    if (isUserSentMessage(m)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  const peerIds = Array.from(latest.keys()).filter(
    (peerId) => (counts.get(peerId) ?? 0) > 0,
  );
  const peerById = await loadPeerProfiles(service, peerIds);
  const emailById = await loadEmailsByUserId(service, [ownerUserId]);
  const ownerEmail = emailById.get(ownerUserId) ?? null;

  return peerIds
    .map((peerId) => {
      const m = latest.get(peerId)!;
      const profile = peerById.get(peerId);
      return {
        ownerUserId,
        ownerEmail,
        peerId,
        peerName: profile?.display_name ?? peerId,
        peerAvatarUrl: profile?.avatar_url ?? "",
        messageCount: counts.get(peerId) ?? 0,
        lastMessageAt: m.created_at,
        lastMessagePreview: previewFromMessage(m),
        lastSender: (m.sender === "me" ? "me" : "peer") as "me" | "peer",
      } satisfies AdminThreadSummary;
    })
    .sort(
      (a, b) =>
        new Date(b.lastMessageAt).getTime() -
        new Date(a.lastMessageAt).getTime(),
    );
}

export async function loadAdminThreadDetail(
  service: SupabaseClient,
  ownerUserId: string,
  peerId: string,
): Promise<AdminThreadDetail> {
  const [{ data: msgs, error: me }, { data: prof }, { data: userData }] =
    await Promise.all([
      service
        .from("chat_messages")
        .select("*")
        .eq("owner_user_id", ownerUserId)
        .eq("peer_id", peerId)
        .order("created_at", { ascending: true }),
      service
        .from("chat_profiles")
        .select("id, display_name, avatar_url")
        .eq("id", peerId)
        .maybeSingle(),
      service.auth.admin.getUserById(ownerUserId),
    ]);

  if (me) throw new Error(me.message);

  const profile = prof as Pick<
    ChatProfileRow,
    "id" | "display_name" | "avatar_url"
  > | null;

  return {
    ownerUserId,
    ownerEmail: userData?.user?.email ?? null,
    peer: {
      id: peerId,
      name: profile?.display_name ?? peerId,
      avatarUrl: profile?.avatar_url ?? "",
    },
    messages: ((msgs ?? []) as ChatMessageRow[]).map((row) => ({
      ...messageRowToUi(row),
      createdAt: row.created_at,
    })),
  };
}
