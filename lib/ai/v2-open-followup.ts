/**
 * v2-only: schedule a bot follow-up when the user opens the chat on her last
 * message but does not reply within {@link V2_OPEN_FOLLOWUP_DELAY_MS}.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isManualOperatorMode } from "@/lib/manual-operator-mode";

export const V2_OPEN_FOLLOWUP_DELAY_MS = 5 * 60_000;

type HistoryRow = { id: string; sender: string; created_at: string };

/** Cancel queued v2 open follow-ups (e.g. user just sent a message). */
export async function supersedeV2OpenFollowups(
  supabase: SupabaseClient,
  ownerUserId: string,
  peerId: string,
): Promise<void> {
  await supabase
    .from("chat_pending_replies")
    .update({
      status: "superseded",
      updated_at: new Date().toISOString(),
    })
    .eq("owner_user_id", ownerUserId)
    .eq("peer_id", peerId)
    .eq("kind", "v2_open_followup")
    .eq("status", "pending");
}

/**
 * Queue a follow-up at now + 5 minutes when the latest message is from the peer.
 * Reschedules if the user re-opens the chat (supersedes prior pending row).
 */
export async function scheduleV2OpenFollowup(
  supabase: SupabaseClient,
  args: {
    ownerUserId: string;
    peerId: string;
  },
): Promise<string | null> {
  if (isManualOperatorMode()) return null;
  const { data: historyRows, error: he } = await supabase
    .from("chat_messages")
    .select("id, sender, created_at")
    .eq("peer_id", args.peerId)
    .eq("owner_user_id", args.ownerUserId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (he || !historyRows?.length) return null;

  const history = historyRows as HistoryRow[];
  const last = history[0];
  if (!last || last.sender !== "peer") return null;

  let userCount = 0;
  let peerCount = 0;
  for (const row of history) {
    if (row.sender === "me") userCount++;
    if (row.sender === "peer") peerCount++;
  }
  if (userCount < 1 || peerCount < 1) return null;

  await supersedeV2OpenFollowups(supabase, args.ownerUserId, args.peerId);

  const at = new Date(Date.now() + V2_OPEN_FOLLOWUP_DELAY_MS);
  const { error } = await supabase.from("chat_pending_replies").insert({
    owner_user_id: args.ownerUserId,
    peer_id: args.peerId,
    user_message_id: null,
    parent_user_message_id: last.id,
    scheduled_at: at.toISOString(),
    status: "pending",
    kind: "v2_open_followup",
    payload_text: null,
  });

  if (error) {
    console.warn(
      "[v2-open-followup] insert failed",
      args.peerId,
      error.message,
    );
    return null;
  }
  return at.toISOString();
}
