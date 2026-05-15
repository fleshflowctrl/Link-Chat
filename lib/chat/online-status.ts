/**
 * Dynamic peer "online now" computation.
 *
 * The legacy chat_profiles.online_now boolean is static — it never moves,
 * which means a persona who *just* sent a message can still show up as
 * "Offline". That kills realism: real dating-app users see the green
 * dot when their match is actually around.
 *
 * This module derives the online-state at request time from three
 * signals:
 *   1. Recency of her last reply in this thread — if she just spoke,
 *      she's online (full stop).
 *   2. Bedtime context (lib/ai/bedtime.ts) — if she's asleep she's offline.
 *   3. Work context (lib/ai/work-schedule.ts) — during deep-focus work
 *      windows she's mostly offline; during breaks she's likely online;
 *      in the evening she's most likely online.
 *
 * Outside the "just spoke" hard window we use deterministic
 * pseudo-randomness keyed on persona-id + a 5-minute clock slot. This
 * way the dot blinks on and off every few minutes (like real users
 * picking up their phone) but stays stable within a single page render
 * — so server-rendered HTML and the next 4-5 minutes of polling agree.
 *
 * All inputs are pure; no DB or network calls. Callers pass in the
 * profile + last peer message timestamp.
 */

import type { ChatProfileRow } from "@/lib/chat/map-rows";
import { getBedtimeContext } from "@/lib/ai/bedtime";
import { getWorkContext } from "@/lib/ai/work-schedule";

const DEFAULT_TZ = "Europe/Amsterdam";

function personaTimeZone(profile: ChatProfileRow): string {
  const meta = profile.persona_meta as { timezone?: string } | null | undefined;
  if (meta?.timezone && typeof meta.timezone === "string" && meta.timezone.trim()) {
    return meta.timezone.trim();
  }
  const env = process.env.PERSONA_DEFAULT_TZ?.trim();
  if (env) return env;
  return DEFAULT_TZ;
}

/** Hard online window — if she replied within this period, ALWAYS online.
 * 4 minutes covers "just-now" replies, the next user message, and the
 * window in which a real woman would still have her phone in hand. */
const RECENT_ACTIVITY_HARD_ONLINE_MS = 4 * 60_000;

/** Soft online window — recently active but maybe drifted away. We
 * still default to online here unless other signals say otherwise (work
 * focus / asleep). */
const RECENT_ACTIVITY_SOFT_ONLINE_MS = 12 * 60_000;

/** djb2 hash — small, fast, deterministic, good enough for picking
 * bucket-shaped pseudo-randomness from a string id. */
function djb2(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  return h >>> 0; // unsigned
}

function getLocalHour(now: Date, tz: string): number {
  try {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      hour12: false,
    });
    const part = fmt.formatToParts(now).find((p) => p.type === "hour");
    const h = part ? parseInt(part.value, 10) : now.getHours();
    return Number.isFinite(h) ? h : now.getHours();
  } catch {
    return now.getHours();
  }
}

export function computePeerOnlineNow(opts: {
  now?: Date;
  profile: ChatProfileRow;
  /** Timestamp of her most recent message in this conversation. NULL
   * when she hasn't sent anything yet (or unknown). */
  lastPeerMessageAt: Date | null;
}): boolean {
  const now = opts.now ?? new Date();
  const lastMs = opts.lastPeerMessageAt?.getTime();
  const ageMs =
    typeof lastMs === "number" && Number.isFinite(lastMs)
      ? now.getTime() - lastMs
      : null;

  // ---- 1. Just chatted ----
  if (ageMs !== null && ageMs >= 0 && ageMs <= RECENT_ACTIVITY_HARD_ONLINE_MS) {
    return true;
  }

  const tz = personaTimeZone(opts.profile);
  const bedtime = getBedtimeContext({
    now,
    timeZone: tz,
    personaId: opts.profile.id,
    peerLastReplyAt: opts.lastPeerMessageAt ?? null,
  });

  // ---- 2. Asleep ----
  if (bedtime.phase === "asleep") return false;

  const work = getWorkContext({
    now,
    timeZone: tz,
    personaId: opts.profile.id,
    occupation: opts.profile.occupation ?? null,
  });

  // ---- 3. Soft window — still around unless deep-focus work ----
  if (ageMs !== null && ageMs >= 0 && ageMs <= RECENT_ACTIVITY_SOFT_ONLINE_MS) {
    if (work.phase === "working") return false; // really at work, app closed
    return true;
  }

  // ---- 4. No recent activity → contextual probability ----
  // Deterministic pseudo-random: stable for ~5 minutes, then shifts.
  const slot = Math.floor(now.getTime() / (5 * 60_000));
  const rng = (djb2(`${opts.profile.id}:${slot}`) % 1000) / 1000; // 0..1

  let pOnline: number;
  if (work.phase === "working") {
    // Deep-focus at work — she rarely peeks. Still ~15% to feel human.
    pOnline = 0.15;
  } else if (work.phase === "approaching_work") {
    // Just before her shift — checking phone on the way in.
    pOnline = 0.45;
  } else if (work.phase === "break" || work.phase === "lunch_break") {
    // On break — likely on her phone.
    pOnline = 0.7;
  } else if (work.phase === "ending_work") {
    // Wrapping up — back to phone.
    pOnline = 0.65;
  } else if (bedtime.phase === "approaching") {
    // Last hour before bed — usually still on her phone.
    pOnline = 0.78;
  } else {
    const localHour = getLocalHour(now, tz);
    if (localHour >= 19 && localHour <= 23) {
      // Prime evening leisure window.
      pOnline = 0.72;
    } else if (localHour >= 8 && localHour <= 18) {
      // Daytime, no specific work signal — moderate.
      pOnline = 0.5;
    } else {
      // Early morning / late night.
      pOnline = 0.3;
    }
  }

  return rng < pOnline;
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
