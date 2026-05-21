import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isNotifiableUserEmail,
  sendUnreadMessageEmail,
  unreadMessagePreview,
} from "@/lib/email/unread-message-email";
import { isPostmarkConfigured } from "@/lib/email/postmark";

type PendingRow = {
  id: string;
  owner_user_id: string;
  peer_id: string;
  peer_message_id: string;
  scheduled_at: string;
};

async function isPeerMessageStillUnread(
  supabase: SupabaseClient,
  args: {
    ownerUserId: string;
    peerId: string;
    messageCreatedAt: string;
  },
): Promise<boolean> {
  const { data: read } = await supabase
    .from("chat_reads")
    .select("last_read_at")
    .eq("owner_user_id", args.ownerUserId)
    .eq("peer_id", args.peerId)
    .maybeSingle();

  const readAt = read?.last_read_at as string | undefined;
  if (!readAt) return true;
  return new Date(readAt).getTime() < new Date(args.messageCreatedAt).getTime();
}

export async function processDueUnreadEmailNotifications(
  supabase: SupabaseClient,
  options: { limit?: number } = {},
): Promise<{ processed: number; sent: number; skipped: number; failed: number }> {
  const limit = options.limit ?? 40;
  const result = { processed: 0, sent: 0, skipped: 0, failed: 0 };

  if (!isPostmarkConfigured()) {
    return result;
  }

  const now = new Date().toISOString();
  const { data: due, error } = await supabase
    .from("chat_unread_email_notifications")
    .select("id, owner_user_id, peer_id, peer_message_id, scheduled_at")
    .eq("status", "pending")
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[unread-email] load due", error.message);
    return result;
  }

  const rows = (due ?? []) as PendingRow[];

  for (const row of rows) {
    result.processed += 1;
    const mark = async (
      status: "sent" | "skipped",
      extra?: { sent_at?: string },
    ) => {
      await supabase
        .from("chat_unread_email_notifications")
        .update({
          status,
          sent_at: extra?.sent_at ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("status", "pending");
    };

    const { data: msg, error: msgErr } = await supabase
      .from("chat_messages")
      .select("id, created_at, body, kind, sender")
      .eq("id", row.peer_message_id)
      .eq("owner_user_id", row.owner_user_id)
      .maybeSingle();

    if (msgErr || !msg || (msg.sender as string) !== "peer") {
      await mark("skipped");
      result.skipped += 1;
      continue;
    }

    const stillUnread = await isPeerMessageStillUnread(supabase, {
      ownerUserId: row.owner_user_id,
      peerId: row.peer_id,
      messageCreatedAt: msg.created_at as string,
    });

    if (!stillUnread) {
      await mark("skipped");
      result.skipped += 1;
      continue;
    }

    const { data: authUser, error: userErr } =
      await supabase.auth.admin.getUserById(row.owner_user_id);

    if (userErr || !authUser.user) {
      await mark("skipped");
      result.skipped += 1;
      continue;
    }

    const email = authUser.user.email ?? null;
    if (!isNotifiableUserEmail(email)) {
      await mark("skipped");
      result.skipped += 1;
      continue;
    }

    const { data: profile } = await supabase
      .from("chat_profiles")
      .select("display_name")
      .eq("id", row.peer_id)
      .maybeSingle();

    const meta = authUser.user.user_metadata as Record<string, unknown> | undefined;
    const appVariant =
      meta?.app_variant === "v2" ? ("v2" as const) : ("v1" as const);

    const sent = await sendUnreadMessageEmail({
      to: email!,
      peerName: (profile?.display_name as string) ?? "Iemand",
      preview: unreadMessagePreview(
        msg.body as string | null,
        (msg.kind as string) ?? "text",
      ),
      peerId: row.peer_id,
      appVariant,
    });

    if (!sent.ok) {
      console.warn("[unread-email] send failed", row.id, sent.error);
      result.failed += 1;
      continue;
    }

    await mark("sent", { sent_at: new Date().toISOString() });
    result.sent += 1;
  }

  return result;
}
