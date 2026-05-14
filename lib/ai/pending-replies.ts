/**
 * Async pending-reply delivery for AI peer chats.
 *
 * Long human-style pauses (10/20/30 minutes, sleep cycles) are scheduled in
 * `chat_pending_replies` and delivered later via this helper. The helper is
 * called from three places:
 *
 *   1. POST /messages — after queueing a new pending row, also process any
 *      already-due rows so a user who's been away catches up immediately.
 *   2. GET /messages — process due rows before returning the message list.
 *   3. POST /poll-pending — fired by a client-side timer when scheduled_at
 *      hits, so the reply lands at the right wall-clock moment.
 *
 * Coalescing: if multiple user messages have piled up while she was "away",
 * we still call Grok ONCE with the full latest history and produce ONE peer
 * reply (mirroring how a real person reads several texts then sends one
 * answer). All due rows are marked done and linked to that single
 * assistant_message_id, except the trigger row which is the oldest one.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ChatMessageRow,
  ChatProfileRow,
} from "@/lib/chat/map-rows";
import { generatePeerReply } from "@/lib/ai/generate-peer-reply";

type PendingRow = {
  user_message_id: string;
  scheduled_at: string;
  status: string;
};

export type ProcessDueResult = {
  newPeerMessages: ChatMessageRow[];
  /** Earliest still-pending scheduled_at for this thread, or null if queue is empty. */
  nextPendingAt: string | null;
};

/**
 * Process all `pending` rows for this thread whose `scheduled_at` is in the
 * past. Generates ONE Grok reply (coalesced), inserts ONE peer message, and
 * marks all processed rows as `done` (or `superseded` if multiple were due).
 *
 * Returns the new peer message(s) — usually zero or one — plus the earliest
 * still-pending scheduled_at so the client can set its next timer.
 *
 * Safe to call repeatedly; idempotent against rows already marked done.
 */
export async function processDuePendingReplies(
  supabase: SupabaseClient,
  args: {
    ownerUserId: string;
    peerId: string;
    profile: ChatProfileRow;
  },
): Promise<ProcessDueResult> {
  const nowIso = new Date().toISOString();

  // Find due pending rows for this thread, ordered oldest-first.
  const { data: dueRows, error: dueErr } = await supabase
    .from("chat_pending_replies")
    .select("user_message_id, scheduled_at, status")
    .eq("owner_user_id", args.ownerUserId)
    .eq("peer_id", args.peerId)
    .eq("status", "pending")
    .lte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true });

  if (dueErr) {
    console.warn("[pending-replies] due select", args.peerId, dueErr.message);
  }

  const due = (dueRows ?? []) as PendingRow[];
  const newPeerMessages: ChatMessageRow[] = [];

  if (due.length === 0) {
    return {
      newPeerMessages,
      nextPendingAt: await earliestPendingAt(supabase, args.ownerUserId, args.peerId),
    };
  }

  // Lock all due rows by flipping to 'processing'. Concurrent callers (rare
  // but possible: user navigates GET messages and timer fires simultaneously)
  // will then see 0 due rows and skip.
  const dueIds = due.map((r) => r.user_message_id);
  const { data: lockedRows, error: lockErr } = await supabase
    .from("chat_pending_replies")
    .update({ status: "processing", updated_at: nowIso })
    .in("user_message_id", dueIds)
    .eq("owner_user_id", args.ownerUserId)
    .eq("status", "pending")
    .select("user_message_id");

  if (lockErr) {
    console.warn("[pending-replies] lock update", args.peerId, lockErr.message);
    return {
      newPeerMessages,
      nextPendingAt: await earliestPendingAt(supabase, args.ownerUserId, args.peerId),
    };
  }

  const actuallyLocked = ((lockedRows ?? []) as Array<{ user_message_id: string }>).map(
    (r) => r.user_message_id,
  );

  if (actuallyLocked.length === 0) {
    // Lost the race to another caller — they'll handle delivery.
    return {
      newPeerMessages,
      nextPendingAt: await earliestPendingAt(supabase, args.ownerUserId, args.peerId),
    };
  }

  // Pull the latest full thread history NOW (not at scheduling time) so Grok
  // sees any user messages that arrived during the wait.
  const { data: historyRows, error: histErr } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("peer_id", args.peerId)
    .eq("owner_user_id", args.ownerUserId)
    .order("created_at", { ascending: true });

  if (histErr || !historyRows) {
    // Mark rows back to pending + bump attempts so they retry on next poll.
    await supabase
      .from("chat_pending_replies")
      .update({
        status: "pending",
        attempts: (due[0] as unknown as { attempts?: number }).attempts ?? 0,
        error: histErr?.message ?? "history fetch failed",
        updated_at: new Date().toISOString(),
      })
      .in("user_message_id", actuallyLocked);
    return {
      newPeerMessages,
      nextPendingAt: await earliestPendingAt(supabase, args.ownerUserId, args.peerId),
    };
  }

  const history = historyRows as ChatMessageRow[];
  const triggerId = actuallyLocked[0]; // oldest due row drives logging/turn-index

  const result = await generatePeerReply(supabase, {
    profile: args.profile,
    history,
    ownerUserId: args.ownerUserId,
    peerId: args.peerId,
    options: { triggerUserMessageId: triggerId },
  });

  const finishedAt = new Date().toISOString();

  if (!result.ok) {
    // Mark all locked rows failed (with error); they won't be retried unless
    // we explicitly re-queue them. Most failures here are Grok outages —
    // safer to surface than to spin forever.
    await supabase
      .from("chat_pending_replies")
      .update({
        status: "failed",
        error: result.error.slice(0, 500),
        updated_at: finishedAt,
      })
      .in("user_message_id", actuallyLocked);
    return {
      newPeerMessages,
      nextPendingAt: await earliestPendingAt(supabase, args.ownerUserId, args.peerId),
    };
  }

  // Trigger row -> done with assistant_message_id. Other rows -> superseded
  // (their reply was coalesced into this one — they aren't going to fire
  // again).
  await supabase
    .from("chat_pending_replies")
    .update({
      status: "done",
      assistant_message_id: result.assistantRow.id,
      updated_at: finishedAt,
    })
    .eq("user_message_id", triggerId)
    .eq("owner_user_id", args.ownerUserId);

  if (actuallyLocked.length > 1) {
    await supabase
      .from("chat_pending_replies")
      .update({
        status: "superseded",
        assistant_message_id: result.assistantRow.id,
        updated_at: finishedAt,
      })
      .in("user_message_id", actuallyLocked.slice(1))
      .eq("owner_user_id", args.ownerUserId);
  }

  newPeerMessages.push(result.assistantRow);

  return {
    newPeerMessages,
    nextPendingAt: await earliestPendingAt(supabase, args.ownerUserId, args.peerId),
  };
}

async function earliestPendingAt(
  supabase: SupabaseClient,
  ownerUserId: string,
  peerId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("chat_pending_replies")
    .select("scheduled_at")
    .eq("owner_user_id", ownerUserId)
    .eq("peer_id", peerId)
    .eq("status", "pending")
    .order("scheduled_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return (data as { scheduled_at: string }).scheduled_at ?? null;
}
