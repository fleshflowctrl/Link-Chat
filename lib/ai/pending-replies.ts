/**
 * Async pending-reply delivery for AI peer chats.
 *
 * Multiple kinds of pending rows now coexist:
 *   - 'reply'       — standard delayed AI reply to a user message
 *   - 'chunk'       — 2nd/3rd bubble of a multi-message reply (no Grok call,
 *                     just insert the precomputed payload_text)
 *   - 'spontaneous' — AI initiates after the user has gone silent for a
 *                     while (~30-90 min). Triggers a fresh Grok call.
 *   - 'winback'     — AI re-engages after 1-3 days of inactivity. Same as
 *                     spontaneous but with a longer-time-gap framing.
 *   - 'pre_ack'     — reserved (not yet emitted)
 *
 * Workflow:
 *   - Find all due pending rows for this thread, oldest first.
 *   - Process 'chunk' rows first, individually (each is independent and
 *     just an insert).
 *   - Then for 'reply' / 'spontaneous' / 'winback': coalesce the reply-type
 *     rows into a single Grok call (real people don't reply twice when they
 *     come back to a stack of messages); spontaneous and winback are still
 *     separate Grok calls because their *reason* for sending differs from a
 *     queued reply.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ChatMessageRow,
  ChatProfileRow,
} from "@/lib/chat/map-rows";
import { BOT_PEER_PHOTOS_ENABLED } from "@/lib/ai/bot-chat-photos";
import { generatePeerReply } from "@/lib/ai/generate-peer-reply";
import { generatePersonaPhoto } from "@/lib/images/generate-photo";
import { buildPersonaPhotoPrompt } from "@/lib/images/persona-photo-prompt";
import { uploadPersonaPhoto } from "@/lib/images/upload-photo";

type PendingRow = {
  id: string;
  user_message_id: string | null;
  parent_user_message_id: string | null;
  scheduled_at: string;
  status: string;
  kind: "reply" | "chunk" | "spontaneous" | "winback" | "pre_ack" | "photo";
  payload_text: string | null;
  attempts?: number;
};

export type ProcessDueResult = {
  newPeerMessages: ChatMessageRow[];
  /** Earliest still-pending scheduled_at for this thread, or null if queue is empty. */
  nextPendingAt: string | null;
  /** True when at least one pending row was due at the start of this call. */
  hadDuePending: boolean;
};

/**
 * Process all `pending` rows for this thread whose `scheduled_at` is in the
 * past. Returns the new peer messages produced (chunk inserts + at most one
 * coalesced reply) plus the earliest still-pending scheduled_at.
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
  const newPeerMessages: ChatMessageRow[] = [];

  const { data: dueRows, error: dueErr } = await supabase
    .from("chat_pending_replies")
    .select("id, user_message_id, parent_user_message_id, scheduled_at, status, kind, payload_text")
    .eq("owner_user_id", args.ownerUserId)
    .eq("peer_id", args.peerId)
    .eq("status", "pending")
    .lte("scheduled_at", nowIso)
    .order("scheduled_at", { ascending: true });

  if (dueErr) {
    console.warn("[pending-replies] due select", args.peerId, dueErr.message);
  }

  const due = (dueRows ?? []) as PendingRow[];
  if (due.length === 0) {
    return {
      newPeerMessages,
      nextPendingAt: await earliestPendingAt(supabase, args.ownerUserId, args.peerId),
      hadDuePending: false,
    };
  }

  // Split by kind for separate handling.
  const chunkRows = due.filter((r) => r.kind === "chunk");
  const photoRows = due.filter((r) => r.kind === "photo");
  const replyRows = due.filter((r) => r.kind === "reply");
  const spontaneousRows = due.filter((r) => r.kind === "spontaneous" || r.kind === "winback");

  // ----- 1. Chunk rows: lock each, insert payload_text as peer message -----
  if (chunkRows.length > 0) {
    const ids = chunkRows.map((r) => r.id);
    const { data: lockedChunks } = await supabase
      .from("chat_pending_replies")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .in("id", ids)
      .eq("owner_user_id", args.ownerUserId)
      .eq("status", "pending")
      .select("id, payload_text");

    const locked = (lockedChunks ?? []) as Array<{ id: string; payload_text: string | null }>;
    for (const ch of locked) {
      const text = (ch.payload_text ?? "").trim();
      if (!text) {
        await supabase
          .from("chat_pending_replies")
          .update({ status: "failed", error: "empty payload", updated_at: new Date().toISOString() })
          .eq("id", ch.id);
        continue;
      }
      const { data: inserted, error: insErr } = await supabase
        .from("chat_messages")
        .insert({
          peer_id: args.peerId,
          sender: "peer",
          kind: "text",
          body: text,
          owner_user_id: args.ownerUserId,
        })
        .select("*")
        .single();
      if (insErr || !inserted) {
        await supabase
          .from("chat_pending_replies")
          .update({
            status: "failed",
            error: (insErr?.message ?? "insert failed").slice(0, 500),
            updated_at: new Date().toISOString(),
          })
          .eq("id", ch.id);
        continue;
      }
      await supabase
        .from("chat_pending_replies")
        .update({
          status: "done",
          assistant_message_id: (inserted as ChatMessageRow).id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ch.id);
      newPeerMessages.push(inserted as ChatMessageRow);
    }
  }

  // ----- 1b. Photo rows: generate via image backend, upload, insert -----
  // Each photo row carries the scene description in payload_text. We build
  // the persona-anchored prompt fresh so the persona stays visually
  // consistent across photos. Failures (Space cold-start, rate limit, etc.)
  // mark the row as failed without affecting the rest of the pipeline.
  if (photoRows.length > 0) {
    if (!BOT_PEER_PHOTOS_ENABLED) {
      const ids = photoRows.map((r) => r.id);
      await supabase
        .from("chat_pending_replies")
        .update({
          status: "failed",
          error: "peer photos disabled",
          updated_at: new Date().toISOString(),
        })
        .in("id", ids)
        .eq("owner_user_id", args.ownerUserId)
        .eq("status", "pending");
    } else {
    const ids = photoRows.map((r) => r.id);
    const { data: lockedPhotos } = await supabase
      .from("chat_pending_replies")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .in("id", ids)
      .eq("owner_user_id", args.ownerUserId)
      .eq("status", "pending")
      .select("id, payload_text");

    const locked = (lockedPhotos ?? []) as Array<{ id: string; payload_text: string | null }>;
    for (const ph of locked) {
      const scene = (ph.payload_text ?? "").trim();
      if (!scene) {
        await supabase
          .from("chat_pending_replies")
          .update({ status: "failed", error: "empty scene", updated_at: new Date().toISOString() })
          .eq("id", ph.id);
        continue;
      }

      // Blur/paywall is disabled — every persona photo (including
      // explicit ones) ships unblurred. We keep writing blur_cost = 0
      // so the column stays consistent with chat_photo_unlocks readers.
      const blurCost = 0;

      const { prompt, seed } = buildPersonaPhotoPrompt({
        profile: args.profile,
        scene,
      });

      const gen = await generatePersonaPhoto({ prompt, seed });
      if (!gen.ok) {
        console.warn(
          "[pending-replies] photo gen failed",
          args.peerId,
          gen.error,
        );
        await supabase
          .from("chat_pending_replies")
          .update({
            status: "failed",
            error: `gen: ${gen.error}`.slice(0, 500),
            updated_at: new Date().toISOString(),
          })
          .eq("id", ph.id);
        continue;
      }

      const up = await uploadPersonaPhoto(supabase, {
        ownerUserId: args.ownerUserId,
        peerId: args.peerId,
        bytes: gen.bytes,
        mime: gen.mime,
      });
      if (!up.ok) {
        console.warn(
          "[pending-replies] photo upload failed",
          args.peerId,
          up.error,
        );
        await supabase
          .from("chat_pending_replies")
          .update({
            status: "failed",
            error: `upload: ${up.error}`.slice(0, 500),
            updated_at: new Date().toISOString(),
          })
          .eq("id", ph.id);
        continue;
      }

      const { data: inserted, error: insErr } = await supabase
        .from("chat_messages")
        .insert({
          peer_id: args.peerId,
          sender: "peer",
          kind: "image",
          body: null,
          image_url: up.publicUrl,
          owner_user_id: args.ownerUserId,
          blur_cost: blurCost,
        })
        .select("*")
        .single();
      if (insErr || !inserted) {
        await supabase
          .from("chat_pending_replies")
          .update({
            status: "failed",
            error: (insErr?.message ?? "insert failed").slice(0, 500),
            updated_at: new Date().toISOString(),
          })
          .eq("id", ph.id);
        continue;
      }

      await supabase
        .from("chat_pending_replies")
        .update({
          status: "done",
          assistant_message_id: (inserted as ChatMessageRow).id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ph.id);
      newPeerMessages.push(inserted as ChatMessageRow);
    }
    }
  }

  // ----- 2. Reply rows: coalesce into ONE Grok call -----
  if (replyRows.length > 0) {
    const ids = replyRows.map((r) => r.id);
    const { data: lockedReplies } = await supabase
      .from("chat_pending_replies")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .in("id", ids)
      .eq("owner_user_id", args.ownerUserId)
      .eq("status", "pending")
      .select("id, user_message_id");

    const locked = (lockedReplies ?? []) as Array<{ id: string; user_message_id: string | null }>;
    if (locked.length > 0) {
      const triggerId = locked[0].user_message_id ?? null;

      const { data: historyRows, error: histErr } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("peer_id", args.peerId)
        .eq("owner_user_id", args.ownerUserId)
        .order("created_at", { ascending: true });

      if (histErr || !historyRows) {
        await supabase
          .from("chat_pending_replies")
          .update({
            status: "pending",
            error: histErr?.message ?? "history fetch failed",
            updated_at: new Date().toISOString(),
          })
          .in("id", locked.map((r) => r.id));
      } else {
        const result = await generatePeerReply(supabase, {
          profile: args.profile,
          history: historyRows as ChatMessageRow[],
          ownerUserId: args.ownerUserId,
          peerId: args.peerId,
          options: { triggerUserMessageId: triggerId ?? undefined },
        });

        const finishedAt = new Date().toISOString();
        if (!result.ok) {
          await supabase
            .from("chat_pending_replies")
            .update({
              status: "failed",
              error: result.error.slice(0, 500),
              updated_at: finishedAt,
            })
            .in("id", locked.map((r) => r.id));
        } else {
          // First locked row -> done with assistant link; rest -> superseded.
          await supabase
            .from("chat_pending_replies")
            .update({
              status: "done",
              assistant_message_id: result.assistantRow.id,
              updated_at: finishedAt,
            })
            .eq("id", locked[0].id);

          if (locked.length > 1) {
            await supabase
              .from("chat_pending_replies")
              .update({
                status: "superseded",
                assistant_message_id: result.assistantRow.id,
                updated_at: finishedAt,
              })
              .in("id", locked.slice(1).map((r) => r.id));
          }
          newPeerMessages.push(result.assistantRow);
        }
      }
    }
  }

  // ----- 3. Spontaneous / winback rows: separate Grok calls (if user
  //         hasn't replied since the row was queued, it still fires) -----
  for (const row of spontaneousRows) {
    const { data: lockedRow } = await supabase
      .from("chat_pending_replies")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .eq("status", "pending")
      .select("id, kind, parent_user_message_id")
      .maybeSingle();

    if (!lockedRow) continue;

    const { data: historyRows } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("peer_id", args.peerId)
      .eq("owner_user_id", args.ownerUserId)
      .order("created_at", { ascending: true });

    if (!historyRows) {
      await supabase
        .from("chat_pending_replies")
        .update({
          status: "pending",
          error: "history fetch failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      continue;
    }

    // If the user has replied since this row was queued (their last message
    // is more recent than the row's parent_user_message_id), the spontaneous
    // is no longer needed — supersede.
    let userHasRepliedSince = false;
    if (row.parent_user_message_id) {
      const parentIdx = (historyRows as ChatMessageRow[]).findIndex((r) => r.id === row.parent_user_message_id);
      if (parentIdx >= 0) {
        for (let i = parentIdx + 1; i < historyRows.length; i++) {
          if ((historyRows as ChatMessageRow[])[i].sender === "me") {
            userHasRepliedSince = true;
            break;
          }
        }
      }
    } else {
      // No parent — winback after total silence; user activity since queue
      // means they came back already. Use last user msg vs row scheduled_at.
      const lastUserAt = lastUserMessageAt(historyRows as ChatMessageRow[]);
      if (lastUserAt && lastUserAt > new Date(row.scheduled_at).getTime()) {
        userHasRepliedSince = true;
      }
    }

    if (userHasRepliedSince) {
      await supabase
        .from("chat_pending_replies")
        .update({
          status: "superseded",
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      continue;
    }

    const result = await generatePeerReply(supabase, {
      profile: args.profile,
      history: historyRows as ChatMessageRow[],
      ownerUserId: args.ownerUserId,
      peerId: args.peerId,
      options: { forceSingleMessage: true },
    });

    const finishedAt = new Date().toISOString();
    if (!result.ok) {
      await supabase
        .from("chat_pending_replies")
        .update({
          status: "failed",
          error: result.error.slice(0, 500),
          updated_at: finishedAt,
        })
        .eq("id", row.id);
    } else {
      await supabase
        .from("chat_pending_replies")
        .update({
          status: "done",
          assistant_message_id: result.assistantRow.id,
          updated_at: finishedAt,
        })
        .eq("id", row.id);
      newPeerMessages.push(result.assistantRow);
    }
  }

  return {
    newPeerMessages,
    nextPendingAt: await earliestPendingAt(supabase, args.ownerUserId, args.peerId),
    hadDuePending: true,
  };
}

function lastUserMessageAt(history: ChatMessageRow[]): number | null {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].sender === "me") {
      const t = new Date(history[i].created_at).getTime();
      if (Number.isFinite(t)) return t;
    }
  }
  return null;
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
