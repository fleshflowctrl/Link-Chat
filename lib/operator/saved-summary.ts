import type { SupabaseClient } from "@supabase/supabase-js";

export type SavedOperatorSummary = {
  summary: string;
  messageCount: number;
  generatedAt: string;
};

export async function getSavedOperatorSummary(
  supabase: SupabaseClient,
  ownerUserId: string,
  peerId: string,
): Promise<SavedOperatorSummary | null> {
  const { data, error } = await supabase
    .from("chat_operator_saved_summary")
    .select("summary, message_count, generated_at")
    .eq("owner_user_id", ownerUserId)
    .eq("peer_id", peerId)
    .maybeSingle();

  if (error || !data?.summary) return null;
  return {
    summary: data.summary as string,
    messageCount: (data.message_count as number) ?? 0,
    generatedAt: (data.generated_at as string) ?? "",
  };
}

export async function saveSavedOperatorSummary(
  supabase: SupabaseClient,
  input: {
    ownerUserId: string;
    peerId: string;
    summary: string;
    messageCount: number;
  },
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase.from("chat_operator_saved_summary").upsert(
    {
      owner_user_id: input.ownerUserId,
      peer_id: input.peerId,
      summary: input.summary,
      message_count: input.messageCount,
      generated_at: now,
    },
    { onConflict: "owner_user_id,peer_id" },
  );
  if (error) {
    console.warn("[operator-summary] save failed", error.message);
  }
}
