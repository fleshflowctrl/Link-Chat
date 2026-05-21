import type { SupabaseClient } from "@supabase/supabase-js";
import { chatUnreadEmailDelayMs } from "@/lib/chat/unread-email-delay-ms";

/**
 * Queue (or reset) a reminder e-mail for this thread. Timer restarts on each new peer message.
 */
export async function scheduleUnreadEmailNotification(
  supabase: SupabaseClient,
  args: {
    ownerUserId: string;
    peerId: string;
    peerMessageId: string;
  },
): Promise<void> {
  const ownerUserId = args.ownerUserId.trim();
  const peerId = args.peerId.trim();
  const peerMessageId = args.peerMessageId.trim();
  if (!ownerUserId || !peerId || !peerMessageId) return;

  const scheduledAt = new Date(
    Date.now() + chatUnreadEmailDelayMs(),
  ).toISOString();
  const now = new Date().toISOString();

  await supabase
    .from("chat_unread_email_notifications")
    .delete()
    .eq("owner_user_id", ownerUserId)
    .eq("peer_id", peerId)
    .eq("status", "pending");

  const { error } = await supabase.from("chat_unread_email_notifications").insert({
    owner_user_id: ownerUserId,
    peer_id: peerId,
    peer_message_id: peerMessageId,
    scheduled_at: scheduledAt,
    status: "pending",
    updated_at: now,
  });

  if (error && !/does not exist/i.test(error.message)) {
    console.warn("[schedule-unread-email]", error.message);
  }
}

/** Cancel pending reminder when the user opens the thread. */
export async function skipPendingUnreadEmailForThread(
  supabase: SupabaseClient,
  args: { ownerUserId: string; peerId: string },
): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from("chat_unread_email_notifications")
    .update({ status: "skipped", updated_at: now })
    .eq("owner_user_id", args.ownerUserId)
    .eq("peer_id", args.peerId)
    .eq("status", "pending");
}
