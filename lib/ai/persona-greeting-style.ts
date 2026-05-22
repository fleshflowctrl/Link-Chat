/**
 * Persona-aware greeting pools — fallbacks vary by voice, not one template.
 */

import type { ChatStyle } from "@/lib/chat/map-rows";
import { MULTI_MESSAGE_SEPARATOR, splitMultiMessage } from "@/lib/ai/post-process-reply";

export type PersonaGreetingStyleInput = {
  peerId: string;
  conversationId?: string;
  personaName?: string;
  chatStyle?: ChatStyle | null;
  age?: number | null;
  city?: string | null;
  vibeTags?: string[] | null;
  flirtLevel?: "low" | "medium" | "high" | "explicit" | string;
  bondFormed?: boolean;
  recentBotMessages?: string[];
  userMessage?: string;
};

export type PersonaGreetingStyle = {
  greetingPool: string[];
  allowFlirtyGreeting: boolean;
  allowAskBack: boolean;
  maxChars: number;
  tone: "soft_warm" | "direct_dry" | "playful_flirty" | "older_simple" | "shy";
};

const VALID_GREETING_CHUNK_RE =
  /^(?:heyy?|hoi|hallo|haa?ai|yo|hee|ja\s+hallo|goedemorgen|goedenavond|goedemiddag|hoihoi)(?:\s+jij)?(?:[,.!]?\s*(?:alles\s+goed|hoe\s+is\s+het|jij))?\s*[!.?…]*\s*$/i;

const GREETING_OPENER_RE =
  /^(?:heyy?|hoi|hey|hallo|hee)(?:[,.!]?\s*(?:alles\s+goed|hoe\s+is\s+het))\s*\??\s*$/i;

const FLIRTY_GREETING_RE =
  /^(?:hoi|heyy?)\s+jij\b|kijk\s+jou\s+dan|daar\s+ben\s+je|haha\s+hey/i;

/** Dev-only: reduce identical greetings across parallel test chats. */
const globalRecentGreetingsDev: string[] = [];
const GLOBAL_DEV_WINDOW = 20;

function hashSeed(parts: string[]): number {
  let h = 2166136261;
  for (const p of parts) {
    for (let i = 0; i < p.length; i++) {
      h ^= p.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
  }
  return h >>> 0;
}

function seededUnit(seed: number, salt: string): number {
  let h = seed;
  for (let i = 0; i < salt.length; i++) {
    h ^= salt.charCodeAt(i);
    h = (h * 1664525 + 1013904223) >>> 0;
  }
  return (h >>> 0) / 0xffffffff;
}

function dayBucket(): string {
  return new Date().toISOString().slice(0, 10);
}

function inferTone(input: PersonaGreetingStyleInput): PersonaGreetingStyle["tone"] {
  const vibes = (input.vibeTags ?? []).map((v) => v.toLowerCase());
  const quirks = (input.chatStyle?.quirks ?? []).join(" ").toLowerCase();
  const flirt =
    input.flirtLevel === "high" ||
    input.flirtLevel === "explicit" ||
    vibes.includes("playful") ||
    vibes.includes("romantic");

  if (input.age != null && input.age >= 38) return "older_simple";
  if (vibes.includes("witty") || flirt) return "playful_flirty";
  if (vibes.includes("caring") || vibes.includes("chill")) return "soft_warm";
  if (input.chatStyle?.punctuation === "clean") return "older_simple";
  if (quirks.includes("stil") || quirks.includes("verlegen")) return "shy";
  if (input.chatStyle?.reply_length === "short") return "direct_dry";
  return "soft_warm";
}

const POOLS: Record<PersonaGreetingStyle["tone"], { pure: string[]; opener: string[]; playful: string[]; dry: string[] }> = {
  soft_warm: {
    pure: ["heyy", "hoi", "hee", "hey"],
    opener: ["heyy, alles goed?", "hoi, alles goed?", "hey, hoe is het?"],
    playful: ["heyy jij", "hoi jij"],
    dry: ["hey", "hoi"],
  },
  direct_dry: {
    pure: ["hey", "hoi", "he", "ja hallo"],
    opener: ["hey", "hoi"],
    playful: ["hoi"],
    dry: ["he", "ja hallo", "hey"],
  },
  playful_flirty: {
    pure: ["heyy", "hoi", "hey"],
    opener: ["heyy, alles goed?", "hey jij"],
    playful: ["heyy jij", "kijk jou dan", "daar ben je", "hoi jij"],
    dry: ["hey", "hoi"],
  },
  older_simple: {
    pure: ["hoi", "hallo", "hey", "goedemiddag"],
    opener: ["hoi, alles goed?", "hallo"],
    playful: ["hoi jij"],
    dry: ["hallo", "hey"],
  },
  shy: {
    pure: ["heyy", "hoi", "hee"],
    opener: ["heyy", "hoi"],
    playful: ["haha hey", "heyy jij"],
    dry: ["hee", "hoi"],
  },
};

export function buildPersonaGreetingStyle(
  input: PersonaGreetingStyleInput,
): PersonaGreetingStyle {
  const tone = inferTone(input);
  const pools = POOLS[tone];
  const flirt =
    input.flirtLevel === "high" ||
    input.flirtLevel === "explicit" ||
    tone === "playful_flirty";

  const greetingPool = [
    ...pools.pure,
    ...pools.opener,
    ...(flirt ? pools.playful : []),
    ...pools.dry,
  ];

  return {
    greetingPool: Array.from(new Set(greetingPool)),
    allowFlirtyGreeting: flirt && tone !== "older_simple",
    allowAskBack: true,
    maxChars: 55,
    tone,
  };
}

function recentPeerOpeningGreetings(recentBotMessages: string[]): string[] {
  return recentBotMessages
    .slice(0, 8)
    .map((m) => m.trim().toLowerCase().replace(/\s+/g, " "))
    .filter((m) => VALID_GREETING_CHUNK_RE.test(m) || GREETING_OPENER_RE.test(m) || FLIRTY_GREETING_RE.test(m));
}

function countHoiJijGlobal(text: string): number {
  return globalRecentGreetingsDev.filter((g) => g === text.toLowerCase()).length;
}

function recordGlobalDevGreeting(text: string): void {
  if (process.env.NODE_ENV !== "development") return;
  const n = text.trim().toLowerCase();
  globalRecentGreetingsDev.unshift(n);
  if (globalRecentGreetingsDev.length > GLOBAL_DEV_WINDOW) {
    globalRecentGreetingsDev.length = GLOBAL_DEV_WINDOW;
  }
}

export type PickPersonaGreetingInput = PersonaGreetingStyleInput & {
  /** Override seed salt for tests */
  seedSalt?: string;
};

/**
 * Weighted pick: pure 45%, opener 35%, playful 15%, dry 5%.
 * "hoi jij" capped — never default when other options exist.
 */
export function pickNonRepeatingPersonaGreeting(input: PickPersonaGreetingInput): string {
  const style = buildPersonaGreetingStyle(input);
  const tone = style.tone;
  const pools = POOLS[tone];
  const seed = hashSeed([
    input.peerId,
    input.conversationId ?? input.peerId,
    dayBucket(),
    input.seedSalt ?? "greeting",
    input.userMessage ?? "hoi",
  ]);

  const flirtBoost = style.allowFlirtyGreeting ? 0.08 : 0;
  const buckets: { weight: number; items: string[] }[] = [
    { weight: 0.45, items: pools.pure },
    { weight: 0.35, items: pools.opener },
    { weight: 0.15 + flirtBoost, items: pools.playful },
    { weight: 0.05, items: pools.dry },
  ];

  const recentPeer = recentPeerOpeningGreetings(input.recentBotMessages ?? []);
  const candidates: string[] = [];

  for (let attempt = 0; attempt < 24; attempt++) {
    const r = seededUnit(seed, `pick-${attempt}`);
    let acc = 0;
    let chosenBucket = buckets[0]!;
    for (const b of buckets) {
      acc += b.weight;
      if (r < acc) {
        chosenBucket = b;
        break;
      }
    }
    const items = chosenBucket.items.filter((g) => g.length <= style.maxChars);
    if (!items.length) continue;
    const idx = Math.floor(seededUnit(seed, `idx-${attempt}`) * items.length);
    const pick = items[idx]!;

    if (pick.toLowerCase() === "hoi jij" && countHoiJijGlobal("hoi jij") >= 2) continue;
    if (recentPeer.includes(pick.toLowerCase())) continue;
    if (
      process.env.NODE_ENV === "development" &&
      globalRecentGreetingsDev.includes(pick.toLowerCase()) &&
      attempt < 12
    ) {
      continue;
    }

    candidates.push(pick);
    recordGlobalDevGreeting(pick);
    return pick;
  }

  const fallback = pools.pure[Math.floor(seededUnit(seed, "fallback") * pools.pure.length)]!;
  recordGlobalDevGreeting(fallback);
  return fallback;
}

export function isValidGreetingOnlyBotReply(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 60) return false;
  const chunks = splitMultiMessage(t, 3);
  if (chunks.length > 2) return false;

  const allGreetish = chunks.every((c) => {
    const chunk = c.trim();
    if (!chunk) return false;
    if (VALID_GREETING_CHUNK_RE.test(chunk)) return true;
    if (GREETING_OPENER_RE.test(chunk)) return true;
    if (FLIRTY_GREETING_RE.test(chunk)) return true;
    if (/^(?:heyy?|hoi|hey|hallo|yo|hee|haa?ai|hoihoi)\b/i.test(chunk) && chunk.length <= 40) {
      return true;
    }
    return false;
  });

  if (!allGreetish) return false;

  if (/\b(?:lunchen|aan\s+het|hoe\s+ziet\s+jouw\s+dag|wat\s+ga\s+je\s+vandaag)\b/i.test(t)) {
    return false;
  }
  if (/^lekker\s+(?:rustig|relaxed)\s+aan\s+het/i.test(chunks[0] ?? "")) return false;

  return true;
}

export function chunkLooksLikeValidGreeting(chunk: string): boolean {
  const t = chunk.trim();
  if (VALID_GREETING_CHUNK_RE.test(t)) return true;
  if (GREETING_OPENER_RE.test(t)) return true;
  if (FLIRTY_GREETING_RE.test(t)) return true;
  const lower = t.toLowerCase().replace(/[^\w\s]/g, "").trim();
  const shorts = new Set([
    "heyy",
    "hey",
    "hoi",
    "hallo",
    "yo",
    "hee",
    "haai",
    "hoihoi",
    "ja",
    "nee",
    "ok",
    "oke",
    "haha",
  ]);
  return shorts.has(lower);
}

/** Soft quality reasons we ignore when the reply is already a valid greeting. */
export const SOFT_GREETING_QUALITY_REASONS = new Set([
  "greeting_only_user_needs_greeting_reply",
  "too_short_incomplete",
]);

export function filterQualityReasonsForGreeting(
  reasons: string[],
  candidateText: string,
  userMessage: string,
): string[] {
  if (!/^(?:hoi|hey|heyy|hallo|ha|hoii|hee)\b/i.test(userMessage.trim())) {
    return reasons;
  }
  if (!isValidGreetingOnlyBotReply(candidateText)) return reasons;
  return reasons.filter((r) => {
    const base = r.split(":")[0] ?? r;
    if (SOFT_GREETING_QUALITY_REASONS.has(base)) return false;
    if (base === "too_short_incomplete") return false;
    return true;
  });
}

export function repairBareGreetingChunk(
  chunk: string,
  input: PickPersonaGreetingInput,
): string {
  const t = chunk.trim();
  if (/^\s*hoi\s*$/i.test(t) || /^\s*hey\s*$/i.test(t)) {
    return pickNonRepeatingPersonaGreeting(input);
  }
  return t;
}
