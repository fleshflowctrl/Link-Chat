import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatMessageRow, ChatProfileRow } from "@/lib/chat/map-rows";
import type { StructuredFacts } from "@/lib/ai/structured-memory";
import type { UserChatPersonaRow } from "@/lib/ai/user-cross-chat-profile";
import { loadOwnerProfileSnippets } from "@/lib/operator/inbox-data";

export type OperatorSummaryContext = {
  ownerUserId: string;
  peerId: string;
  ownerDisplayName: string;
  ownerEmail: string | null;
  ownerAge: number | null;
  ownerLocation: string;
  ownerBio: string;
  ownerLookingFor: string;
  peerDisplayName: string;
  messages: ChatMessageRow[];
  threadMemorySummary: string | null;
  structuredFacts: StructuredFacts | null;
  userChatPersona: UserChatPersonaRow | null;
};

function parseStructuredFacts(raw: unknown): StructuredFacts | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as StructuredFacts;
}

function parseUserChatPersona(row: Record<string, unknown> | null): UserChatPersonaRow | null {
  if (!row || typeof row.summary !== "string" || !row.summary.trim()) return null;
  return {
    user_id: row.user_id as string,
    summary: row.summary as string,
    traits: Array.isArray(row.traits) ? (row.traits as string[]) : [],
    topics: Array.isArray(row.topics) ? (row.topics as string[]) : [],
    flirt_level: (row.flirt_level as UserChatPersonaRow["flirt_level"]) ?? "medium",
    communication_pace:
      (row.communication_pace as UserChatPersonaRow["communication_pace"]) ?? "normal",
    message_length:
      (row.message_length as UserChatPersonaRow["message_length"]) ?? "medium",
    wants: Array.isArray(row.wants) ? (row.wants as string[]) : [],
    avoids: Array.isArray(row.avoids) ? (row.avoids as string[]) : [],
    messages_analyzed: Number(row.messages_analyzed) || 0,
    updated_at: (row.updated_at as string) ?? "",
  };
}

export async function loadOperatorSummaryContext(
  supabase: SupabaseClient,
  ownerUserId: string,
  peerId: string,
): Promise<OperatorSummaryContext | null> {
  const { data: peer, error: pe } = await supabase
    .from("chat_profiles")
    .select("id, display_name")
    .eq("id", peerId)
    .maybeSingle();
  if (pe || !peer) return null;

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("owner_user_id", ownerUserId)
    .eq("peer_id", peerId)
    .order("created_at", { ascending: true });

  const { data: mem } = await supabase
    .from("chat_ai_thread_memory")
    .select("summary, structured_facts")
    .eq("owner_user_id", ownerUserId)
    .eq("peer_id", peerId)
    .maybeSingle();

  const { data: userProfile } = await supabase
    .from("user_profiles")
    .select("first_name, age, location, bio, looking_for")
    .eq("user_id", ownerUserId)
    .maybeSingle();

  const { data: crossPersona } = await supabase
    .from("user_chat_persona")
    .select("*")
    .eq("user_id", ownerUserId)
    .maybeSingle();

  const { data: authData } = await supabase.auth.admin.getUserById(ownerUserId);
  const ownerMap = await loadOwnerProfileSnippets(supabase, [ownerUserId]);
  const ownerSnippet = ownerMap.get(ownerUserId);

  return {
    ownerUserId,
    peerId,
    ownerDisplayName: ownerSnippet?.displayName ?? "Gebruiker",
    ownerEmail: authData?.user?.email ?? null,
    ownerAge:
      typeof userProfile?.age === "number" && userProfile.age > 0
        ? userProfile.age
        : (ownerSnippet?.age ?? null),
    ownerLocation:
      (userProfile?.location as string)?.trim() || ownerSnippet?.location || "",
    ownerBio: (userProfile?.bio as string)?.trim() || "",
    ownerLookingFor: (userProfile?.looking_for as string)?.trim() || "",
    peerDisplayName: (peer as ChatProfileRow).display_name ?? "Profiel",
    messages: (messages ?? []) as ChatMessageRow[],
    threadMemorySummary:
      mem && typeof mem.summary === "string" ? mem.summary.trim() : null,
    structuredFacts: parseStructuredFacts(mem?.structured_facts),
    userChatPersona: parseUserChatPersona(
      crossPersona as Record<string, unknown> | null,
    ),
  };
}
