import type { AppVariant } from "@/lib/app-variant";
import { USER_BURST_COALESCE_MS_DEFAULT } from "@/lib/chat/burst-coalesce-ms";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatMessageRow } from "@/lib/chat/map-rows";

/** Wait this long after the latest user line before calling Grok so rapid
 * double-texts become one reply. Override via XAI_USER_BURST_COALESCE_MS. */
export function userBurstCoalesceMs(): number {
  const raw = process.env.XAI_USER_BURST_COALESCE_MS?.trim();
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) return Math.min(Math.round(n), 15_000);
  }
  return USER_BURST_COALESCE_MS_DEFAULT;
}

/** User messages since the persona's last reply (inclusive of the trigger). */
export function userMessagesSinceLastPeerReply(
  history: ChatMessageRow[],
): ChatMessageRow[] {
  let lastPeerIdx = -1;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].sender === "peer") {
      lastPeerIdx = i;
      break;
    }
  }
  const start = lastPeerIdx + 1;
  return history.slice(start).filter((m) => m.sender === "me");
}

/** Total chars across the user burst (for pacing). */
export function userBurstCharCount(history: ChatMessageRow[]): number {
  return userMessagesSinceLastPeerReply(history).reduce((sum, m) => {
    if (m.kind === "image") return sum + 80;
    return sum + (m.body ?? "").trim().length;
  }, 0);
}

/** Supersede queued standard replies so only one Grok call fires for the burst. */
export async function supersedePendingReplyRows(
  supabase: SupabaseClient,
  ownerUserId: string,
  peerId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("chat_pending_replies")
    .update({ status: "superseded", updated_at: now })
    .eq("owner_user_id", ownerUserId)
    .eq("peer_id", peerId)
    .eq("kind", "reply")
    .eq("status", "pending");
  if (error) {
    console.warn(
      "[coalesce-user-reply] supersede pending reply",
      peerId,
      error.message,
    );
  }
}

export type QueueCoalescedReplyResult =
  | {
      ok: true;
      scheduledAtIso: string;
      /** When to run Grok (coalesce window only — not full pacing). */
      coalesceDelayMs: number;
      /** Optional short pause after Grok before the bubble lands (typing beat). */
      postGrokDelayMs: number;
    }
  | { ok: false; error: string };

/** Short pause after Grok returns so typing can finish right before the text. */
export function postGrokDisplayDelayMs(
  pacingDelayMs: number,
  appVariant?: AppVariant,
): number {
  const coalesce = userBurstCoalesceMs();
  const surplus = Math.max(0, pacingDelayMs - coalesce);
  if (surplus <= 0) return 0;
  // v2: keep the “she's typing” beat tight — long pre-Grok waits felt broken.
  if (appVariant === "v2") {
    return Math.min(2800, Math.round(surplus * 0.12));
  }
  return Math.min(6000, Math.round(surplus * 0.25));
}

/** Queue one coalesced reply; resets the timer when the user sends again. */
export async function queueCoalescedPeerReply(
  supabase: SupabaseClient,
  args: {
    ownerUserId: string;
    peerId: string;
    userMessageId: string;
    pacingDelayMs: number;
    appVariant?: AppVariant;
  },
): Promise<QueueCoalescedReplyResult> {
  await supersedePendingReplyRows(supabase, args.ownerUserId, args.peerId);

  const coalesceMs = userBurstCoalesceMs();
  const scheduledAtIso = new Date(Date.now() + coalesceMs).toISOString();
  const postGrokDelayMs = postGrokDisplayDelayMs(args.pacingDelayMs, args.appVariant);

  const { error } = await supabase.from("chat_pending_replies").insert({
    user_message_id: args.userMessageId,
    owner_user_id: args.ownerUserId,
    peer_id: args.peerId,
    scheduled_at: scheduledAtIso,
    status: "pending",
    kind: "reply",
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  return { ok: true, scheduledAtIso, coalesceDelayMs: coalesceMs, postGrokDelayMs };
}
