/**
 * Spontaneous re-engagement scheduler.
 *
 * Two flavours of "AI talks first":
 *
 *   1. SPONTANEOUS — after the user has gone quiet 30-90 minutes during an
 *      active conversation, the persona (sometimes) sends a small follow-up:
 *      a thought she had, a callback, a "ben je daar nog?" — without nagging.
 *      Probability: ~18% chance to schedule a row when invoked.
 *
 *   2. WINBACK — after the user hasn't messaged for 24-72 hours and the chat
 *      previously had real flow, schedule a single warm winback ping. Higher
 *      probability (~50%) since the cost of nothing is high and the user is
 *      drifting. Capped at one winback per inactivity stretch.
 *
 * Both are stored in chat_pending_replies with kind='spontaneous' or 'winback'.
 * They're delivered by processDuePendingReplies which also checks if the user
 * has come back in the meantime — in which case the row is superseded.
 *
 * Called from POST /messages right after the user message lands. The schedule
 * targets a random time in a window so multiple personas don't all ping the
 * user at the same minute.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatMessageRow } from "@/lib/chat/map-rows";
import { getBedtimeContext } from "@/lib/ai/bedtime";
import { isManualOperatorMode } from "@/lib/manual-operator-mode";

/** Time window after the trigger user message during which a spontaneous
 * follow-up may land. We pick a uniform random ms in this window so the
 * exact moment is unpredictable. */
const SPONTANEOUS_MIN_MS = 30 * 60_000; // 30 min
const SPONTANEOUS_MAX_MS = 90 * 60_000; // 90 min

/** Winback fires only after at least this much continuous user-side silence. */
const WINBACK_MIN_INACTIVITY_MS = 22 * 60 * 60_000; // 22h
const WINBACK_MAX_INACTIVITY_MS = 72 * 60 * 60_000; // 72h
/** Within those windows, schedule the winback to fire ~6-30h from now. */
const WINBACK_SCHEDULE_MIN_MS = 6 * 60 * 60_000;
const WINBACK_SCHEDULE_MAX_MS = 30 * 60 * 60_000;

const SPONTANEOUS_PROB = 0.18;
const WINBACK_PROB = 0.5;

function pickInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Persona's local timezone — keep in sync with generate-peer-reply. */
function personaTimeZone(): string {
  const env = process.env.PERSONA_DEFAULT_TZ?.trim();
  if (env) return env;
  return "Europe/Amsterdam";
}

/** Move a target time off the persona's sleep window. If `target` lands
 * during her likely sleep, push it to a believable wake time. */
function avoidSleepHours(target: Date, peerId: string): Date {
  const tz = personaTimeZone();
  const ctx = getBedtimeContext({
    now: target,
    timeZone: tz,
    personaId: peerId,
    peerLastReplyAt: null,
  });
  if (ctx.phase === "asleep") {
    // wakeAfter is "if she's asleep now, when does she wake up next" — perfect.
    return ctx.wakeAfter;
  }
  return target;
}

/**
 * Schedule a spontaneous follow-up if conditions are met. Returns the
 * scheduled_at (ISO) or null if nothing was scheduled.
 *
 * Conditions:
 *   - Random gate (~18%): keeps the persona from spamming.
 *   - No existing pending spontaneous/winback row for this thread.
 *   - At least one prior peer<->user exchange (so this is mid-flow, not
 *     a cold first turn).
 */
export async function maybeScheduleSpontaneous(
  supabase: SupabaseClient,
  args: {
    ownerUserId: string;
    peerId: string;
    triggerUserMessageId: string;
    history: ChatMessageRow[];
  },
): Promise<string | null> {
  if (isManualOperatorMode()) return null;
  if (Math.random() >= SPONTANEOUS_PROB) return null;

  // Need an established back-and-forth — at least 2 peer turns and 2 user.
  let peerCount = 0;
  let userCount = 0;
  for (const row of args.history) {
    if (row.sender === "peer") peerCount++;
    if (row.sender === "me") userCount++;
  }
  if (peerCount < 2 || userCount < 2) return null;

  // Don't double-up if any spontaneous/winback already pending for this thread.
  const { data: existing } = await supabase
    .from("chat_pending_replies")
    .select("id")
    .eq("owner_user_id", args.ownerUserId)
    .eq("peer_id", args.peerId)
    .in("kind", ["spontaneous", "winback", "v2_open_followup"])
    .eq("status", "pending")
    .limit(1);
  if (existing && existing.length > 0) return null;

  const offsetMs = pickInRange(SPONTANEOUS_MIN_MS, SPONTANEOUS_MAX_MS);
  const naive = new Date(Date.now() + offsetMs);
  const at = avoidSleepHours(naive, args.peerId);

  const { error } = await supabase
    .from("chat_pending_replies")
    .insert({
      owner_user_id: args.ownerUserId,
      peer_id: args.peerId,
      user_message_id: null,
      parent_user_message_id: args.triggerUserMessageId,
      scheduled_at: at.toISOString(),
      status: "pending",
      kind: "spontaneous",
      payload_text: null,
    });

  if (error) {
    console.warn("[spontaneous] insert failed", args.peerId, error.message);
    return null;
  }
  return at.toISOString();
}

/**
 * Schedule a winback ping if the user has been silent for >22h on a
 * previously active thread, and we don't already have a winback queued.
 *
 * Intended to be called by a periodic worker (cron or invoked lazily on
 * GET) — see app/api/conversations/[peerId]/poll-pending. For now we
 * expose this as a helper that the GET endpoint can call to check + queue.
 */
export async function maybeScheduleWinback(
  supabase: SupabaseClient,
  args: {
    ownerUserId: string;
    peerId: string;
    history: ChatMessageRow[];
  },
): Promise<string | null> {
  if (isManualOperatorMode()) return null;
  if (Math.random() >= WINBACK_PROB) return null;

  // Need a real prior conversation — winback isn't for fresh chats.
  let peerCount = 0;
  let userCount = 0;
  let lastUserAt = 0;
  for (const row of args.history) {
    if (row.sender === "peer") peerCount++;
    if (row.sender === "me") {
      userCount++;
      const t = new Date(row.created_at).getTime();
      if (Number.isFinite(t) && t > lastUserAt) lastUserAt = t;
    }
  }
  if (peerCount < 5 || userCount < 5 || lastUserAt === 0) return null;

  const inactivityMs = Date.now() - lastUserAt;
  if (inactivityMs < WINBACK_MIN_INACTIVITY_MS) return null;
  if (inactivityMs > WINBACK_MAX_INACTIVITY_MS) return null; // too cold; let it lie

  // Don't double-up.
  const { data: existing } = await supabase
    .from("chat_pending_replies")
    .select("id")
    .eq("owner_user_id", args.ownerUserId)
    .eq("peer_id", args.peerId)
    .in("kind", ["spontaneous", "winback", "v2_open_followup"])
    .in("status", ["pending", "processing"])
    .limit(1);
  if (existing && existing.length > 0) return null;

  const offsetMs = pickInRange(WINBACK_SCHEDULE_MIN_MS, WINBACK_SCHEDULE_MAX_MS);
  const naive = new Date(Date.now() + offsetMs);
  const at = avoidSleepHours(naive, args.peerId);

  const { error } = await supabase
    .from("chat_pending_replies")
    .insert({
      owner_user_id: args.ownerUserId,
      peer_id: args.peerId,
      user_message_id: null,
      parent_user_message_id: null,
      scheduled_at: at.toISOString(),
      status: "pending",
      kind: "winback",
      payload_text: null,
    });

  if (error) {
    console.warn("[winback] insert failed", args.peerId, error.message);
    return null;
  }
  return at.toISOString();
}
