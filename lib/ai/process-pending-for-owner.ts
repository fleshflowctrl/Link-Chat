/**
 * Process due async AI replies for one user (all threads or a single peer).
 * Used by cron, inbox sync, and the app-shell heartbeat.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatMessageRow, ChatProfileRow } from "@/lib/chat/map-rows";
import { processDuePendingReplies } from "@/lib/ai/pending-replies";
import { maybeScheduleWinback } from "@/lib/ai/spontaneous";
import { isManualOperatorMode } from "@/lib/manual-operator-mode";

export type ProcessPendingForOwnerResult = {
  threadsProcessed: number;
  messagesDelivered: number;
  errors: number;
};

type DueThread = { ownerUserId: string; peerId: string };

function dedupeThreads(rows: Array<{ owner_user_id: string; peer_id: string }>): DueThread[] {
  const seen = new Set<string>();
  const out: DueThread[] = [];
  for (const r of rows) {
    const key = `${r.owner_user_id}:${r.peer_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ownerUserId: r.owner_user_id, peerId: r.peer_id });
  }
  return out;
}

/** Distinct owner+peer pairs with at least one due pending row. */
export async function listDuePendingThreads(
  supabase: SupabaseClient,
  filter: { ownerUserId?: string; maxRows?: number },
): Promise<DueThread[]> {
  const nowIso = new Date().toISOString();
  let q = supabase
    .from("chat_pending_replies")
    .select("owner_user_id, peer_id, scheduled_at")
    .eq("status", "pending")
    .lte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true })
    .limit(filter.maxRows ?? 40);

  if (filter.ownerUserId) {
    q = q.eq("owner_user_id", filter.ownerUserId);
  }

  const { data, error } = await q;
  if (error) {
    console.warn("[process-pending] list due", error.message);
    return [];
  }
  return dedupeThreads((data ?? []) as Array<{ owner_user_id: string; peer_id: string }>);
}

/** Rows stuck in processing (crashed worker) become deliverable again. */
export async function recoverStuckPendingReplies(
  supabase: SupabaseClient,
): Promise<void> {
  const staleBefore = new Date(Date.now() - 5 * 60_000).toISOString();
  const { error } = await supabase
    .from("chat_pending_replies")
    .update({ status: "pending", updated_at: new Date().toISOString() })
    .eq("status", "processing")
    .is("assistant_message_id", null)
    .lt("updated_at", staleBefore);
  if (error) {
    console.warn("[process-pending] recover stuck", error.message);
  }
}

export async function processPendingForOwner(
  supabase: SupabaseClient,
  args: {
    ownerUserId: string;
    peerId?: string;
    maxThreads?: number;
    scheduleWinback?: boolean;
  },
): Promise<ProcessPendingForOwnerResult> {
  if (isManualOperatorMode()) {
    return { threadsProcessed: 0, messagesDelivered: 0, errors: 0 };
  }
  const maxThreads = args.maxThreads ?? 8;
  let threads: DueThread[];

  if (args.peerId) {
    threads = [{ ownerUserId: args.ownerUserId, peerId: args.peerId }];
  } else {
    threads = (
      await listDuePendingThreads(supabase, {
        ownerUserId: args.ownerUserId,
        maxRows: maxThreads * 4,
      })
    ).slice(0, maxThreads);
  }

  let threadsProcessed = 0;
  let messagesDelivered = 0;
  let errors = 0;

  for (const { peerId } of threads) {
    try {
      const { data: profile, error: pe } = await supabase
        .from("chat_profiles")
        .select("*")
        .eq("id", peerId)
        .maybeSingle();

      if (pe || !profile || !(profile as ChatProfileRow).is_ai) continue;

      const p = profile as ChatProfileRow;
      const r = await processDuePendingReplies(supabase, {
        ownerUserId: args.ownerUserId,
        peerId,
        profile: p,
      });
      threadsProcessed += 1;
      messagesDelivered += r.newPeerMessages.length;

      if (args.scheduleWinback && r.newPeerMessages.length >= 0) {
        try {
          const { data: hist } = await supabase
            .from("chat_messages")
            .select("id, sender, created_at, kind, body")
            .eq("peer_id", peerId)
            .eq("owner_user_id", args.ownerUserId)
            .order("created_at", { ascending: true });
          if (hist) {
            await maybeScheduleWinback(supabase, {
              ownerUserId: args.ownerUserId,
              peerId,
              history: hist as ChatMessageRow[],
            });
          }
        } catch (e) {
          console.warn("[process-pending] winback", peerId, e);
        }
      }
    } catch (e) {
      errors += 1;
      console.error(
        "[process-pending] thread failed",
        args.ownerUserId,
        peerId,
        e instanceof Error ? e.message : String(e),
      );
    }
  }

  return { threadsProcessed, messagesDelivered, errors };
}

/** Cron: process due threads across all users (service role). */
export async function processAllDuePendingGlobally(
  supabase: SupabaseClient,
  args?: { maxThreadsPerBatch?: number; timeBudgetMs?: number },
): Promise<ProcessPendingForOwnerResult & { batches: number }> {
  if (isManualOperatorMode()) {
    return { threadsProcessed: 0, messagesDelivered: 0, errors: 0, batches: 0 };
  }
  const maxThreadsPerBatch = args?.maxThreadsPerBatch ?? 16;
  const deadline = Date.now() + (args?.timeBudgetMs ?? 100_000);

  let threadsProcessed = 0;
  let messagesDelivered = 0;
  let errors = 0;
  let batches = 0;

  await recoverStuckPendingReplies(supabase);

  while (Date.now() < deadline) {
    const due = await listDuePendingThreads(supabase, {
      maxRows: maxThreadsPerBatch * 3,
    });
    const slice = due.slice(0, maxThreadsPerBatch);
    if (slice.length === 0) break;

    batches += 1;
    for (const { ownerUserId, peerId } of slice) {
      const r = await processPendingForOwner(supabase, {
        ownerUserId,
        peerId,
        maxThreads: 1,
        scheduleWinback: false,
      });
      threadsProcessed += r.threadsProcessed;
      messagesDelivered += r.messagesDelivered;
      errors += r.errors;
    }

    if (slice.length < maxThreadsPerBatch) break;
  }

  return { threadsProcessed, messagesDelivered, errors, batches };
}
