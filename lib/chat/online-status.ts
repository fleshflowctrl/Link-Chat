/**
 * Peer presence for chat header + inbox dot.
 *
 * Shows "Typt…" while a reply is being delivered, otherwise last-seen or offline.
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

export type ChatHeaderPresenceVariant = "typing" | "online" | "offline";

export type ChatHeaderPresence = {
  variant: ChatHeaderPresenceVariant;
  label: string;
  showGreenDot: boolean;
};

function defaultTimeZone(): string {
  const env = process.env.PERSONA_DEFAULT_TZ?.trim();
  return env || "Europe/Amsterdam";
}

function lastPeerMessageFromHistory(
  messages: Array<{ sender: string; createdAt?: string }>,
): Date | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.sender !== "peer" || !m.createdAt) continue;
    const t = new Date(m.createdAt);
    if (!Number.isNaN(t.getTime())) return t;
  }
  return null;
}

/** Dutch "Laatst gezien …" for the chat header when she's not live. */
export function formatLastSeenNl(lastActiveAt: Date, now: Date = new Date()): string {
  const ageMs = Math.max(0, now.getTime() - lastActiveAt.getTime());
  const mins = Math.floor(ageMs / 60_000);
  if (mins < 1) return "Laatst gezien zojuist";
  if (mins < 60) {
    return mins === 1
      ? "Laatst gezien 1 min geleden"
      : `Laatst gezien ${mins} min geleden`;
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return hours === 1
      ? "Laatst gezien 1 uur geleden"
      : `Laatst gezien ${hours} uur geleden`;
  }

  const dayMs = 24 * 60 * 60_000;
  const days = Math.floor(ageMs / dayMs);
  if (days === 1) return "Laatst gezien gisteren";
  if (days < 7) return `Laatst gezien ${days} dagen geleden`;

  try {
    const fmt = new Intl.DateTimeFormat("nl-NL", {
      day: "numeric",
      month: "short",
      timeZone: defaultTimeZone(),
    });
    return `Laatst gezien ${fmt.format(lastActiveAt)}`;
  } catch {
    return "Offline";
  }
}

/** Page-3 header subtitle — offline (last seen) or typing. */
export function getChatHeaderPresence(opts: {
  messages: Array<{ sender: string; createdAt?: string }>;
  peerTyping?: boolean;
  personaId: string;
  /** Matches discover card badge for this hourly slot (page 1 ↔ page 3). */
  discoverBucket?: "live" | "new" | "default";
  now?: Date;
  timeZone?: string;
}): ChatHeaderPresence {
  const now = opts.now ?? new Date();

  if (opts.peerTyping) {
    return { variant: "typing", label: "Typt…", showGreenDot: true };
  }

  const lastPeerMessageAt = lastPeerMessageFromHistory(opts.messages);

  if (lastPeerMessageAt) {
    return {
      variant: "offline",
      label: formatLastSeenNl(lastPeerMessageAt, now),
      showGreenDot: false,
    };
  }

  return { variant: "offline", label: "Offline", showGreenDot: false };
}
