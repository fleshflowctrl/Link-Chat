/**
 * Peer presence for chat header + inbox dot.
 *
 * "Nu online" only briefly after she sent in this thread. Otherwise show a
 * realistic last-seen label, "Slapend" during her sleep window, or "Typt…"
 * while a reply is being delivered.
 */

import { getBedtimeContext } from "@/lib/ai/bedtime";
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

export type ChatHeaderPresenceVariant =
  | "typing"
  | "online"
  | "offline"
  | "asleep";

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

/** Page-3 header subtitle — online, offline (last seen), asleep, or typing. */
export function getChatHeaderPresence(opts: {
  messages: Array<{ sender: string; createdAt?: string }>;
  peerTyping?: boolean;
  personaId: string;
  now?: Date;
  timeZone?: string;
}): ChatHeaderPresence {
  const now = opts.now ?? new Date();
  const tz = opts.timeZone ?? defaultTimeZone();

  if (opts.peerTyping) {
    return { variant: "typing", label: "Typt…", showGreenDot: true };
  }

  const lastPeerMessageAt = lastPeerMessageFromHistory(opts.messages);
  const last = opts.messages[opts.messages.length - 1];
  const lastMessageSender =
    last?.sender === "peer" ? "peer" : last?.sender === "me" ? "me" : null;

  const bedtime = getBedtimeContext({
    now,
    timeZone: tz,
    personaId: opts.personaId,
    peerLastReplyAt: lastPeerMessageAt,
  });

  if (bedtime.phase === "asleep") {
    return { variant: "asleep", label: "Slapend", showGreenDot: false };
  }

  const online = computePeerOnlineNow({
    profile: {} as ChatProfileRow,
    lastPeerMessageAt,
    lastMessageSender,
    now,
  });

  if (online) {
    return { variant: "online", label: "Nu online", showGreenDot: true };
  }

  if (lastPeerMessageAt) {
    return {
      variant: "offline",
      label: formatLastSeenNl(lastPeerMessageAt, now),
      showGreenDot: false,
    };
  }

  return { variant: "offline", label: "Offline", showGreenDot: false };
}
