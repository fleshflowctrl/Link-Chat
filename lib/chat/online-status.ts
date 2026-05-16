/**
 * Peer "online" — only true briefly after she sent a message in this thread.
 * No random ambient online; that felt fake when the dot was on most of the day.
 */

import type { ChatProfileRow } from "@/lib/chat/map-rows";

/** Green dot / "Nu online" — phone still in hand after her last bubble. */
const RECENT_ACTIVITY_HARD_ONLINE_MS = 90_000;

export function computePeerOnlineNow(opts: {
  now?: Date;
  profile: ChatProfileRow;
  /** Timestamp of her most recent message in this conversation. NULL
   * when she hasn't sent anything yet (or unknown). */
  lastPeerMessageAt: Date | null;
  /** Who sent the latest message in the thread. When it's the user, she's
   * almost never "live" — she's away until her async reply lands. */
  lastMessageSender?: "me" | "peer" | null;
}): boolean {
  const now = opts.now ?? new Date();

  if (opts.lastMessageSender === "me") {
    return false;
  }

  const lastMs = opts.lastPeerMessageAt?.getTime();
  const ageMs =
    typeof lastMs === "number" && Number.isFinite(lastMs)
      ? now.getTime() - lastMs
      : null;

  if (ageMs !== null && ageMs >= 0 && ageMs <= RECENT_ACTIVITY_HARD_ONLINE_MS) {
    return true;
  }

  return false;
}

/** Convenience helper for the client: given a peer's last message
 * timestamp, decide whether to show the green dot RIGHT NOW. The
 * client uses this to flip the header from "Offline" to "Nu online"
 * the moment a new bot message lands. */
export function isClientOnlineFromLastMessageAt(
  lastPeerMessageAt: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!lastPeerMessageAt) return false;
  const t =
    lastPeerMessageAt instanceof Date
      ? lastPeerMessageAt.getTime()
      : new Date(lastPeerMessageAt).getTime();
  if (!Number.isFinite(t)) return false;
  const age = now.getTime() - t;
  return age >= 0 && age <= RECENT_ACTIVITY_HARD_ONLINE_MS;
}

/** Client chat header — only "live" right after she sent (not while waiting on your reply). */
export function isPeerLiveInChat(opts: {
  messages: Array<{ sender: string; createdAt?: string }>;
  now?: Date;
}): boolean {
  const now = opts.now ?? new Date();
  if (opts.messages.length === 0) return false;

  const last = opts.messages[opts.messages.length - 1];
  if (last.sender === "me") return false;
  if (last.sender !== "peer" || !last.createdAt) return false;

  const t = new Date(last.createdAt).getTime();
  if (!Number.isFinite(t)) return false;
  const age = now.getTime() - t;
  return age >= 0 && age <= RECENT_ACTIVITY_HARD_ONLINE_MS;
}
