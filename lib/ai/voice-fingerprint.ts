/**
 * Voice fingerprint enforcement.
 *
 * The model is told via the system prompt which signature words / emojis /
 * quirks belong to this persona, but Grok drifts back to "neutral chat
 * voice" within 4-5 messages. To prevent that we run a hard post-process
 * pass that:
 *
 * 1. Detects whether at least one signature word/emoji is already present.
 * 2. With ~30% probability injects a missing one, in a way that looks
 *    organic (start of a chunk, end of a chunk, or as its own micro-bubble).
 * 3. Optionally applies the structural quirk (lowercase, drop dots, etc.).
 *
 * It runs AFTER `splitIntoChunks` so each chunk is treated independently —
 * keeps the rhythm natural and avoids stuffing all signatures into one bubble.
 */

import type { ChatStyle } from "@/lib/chat/map-rows";

type Rng = () => number;

function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  if (s === 0) s = 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function toSeed(strings: string[]): number {
  let h = 2166136261;
  for (const s of strings) {
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
  }
  return h >>> 0;
}

function pick<T>(arr: readonly T[], rng: Rng): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(rng() * arr.length)];
}

function normalize(s: string): string {
  return s.toLowerCase();
}

function chunkContainsAny(chunk: string, needles: string[]): boolean {
  if (needles.length === 0) return true;
  const c = normalize(chunk);
  for (const n of needles) {
    const k = normalize(n.trim());
    if (k.length === 0) continue;
    if (c.includes(k)) return true;
  }
  return false;
}

function chunkContainsAnyEmoji(chunk: string, emojis: string[]): boolean {
  if (emojis.length === 0) return true;
  for (const e of emojis) {
    if (e.trim().length === 0) continue;
    if (chunk.includes(e)) return true;
  }
  return false;
}

function injectSignatureWord(chunk: string, word: string, rng: Rng): string {
  const trimmed = chunk.trim();
  if (trimmed.length === 0) return chunk;

  // Don't inject inside [SEND_PHOTO: ...] directives or photo lines.
  if (/^\[SEND_PHOTO/i.test(trimmed)) return chunk;

  // Don't double-inject.
  if (normalize(chunk).includes(normalize(word))) return chunk;

  const r = rng();
  if (r < 0.45) {
    // Prepend, lower-cased softly.
    const sep = /^[a-z]/.test(trimmed) ? " " : ", ";
    return `${word.toLowerCase()}${sep}${trimmed}`;
  } else if (r < 0.85) {
    // Append.
    const trail = /[.!?]$/.test(trimmed) ? "" : "";
    return `${trimmed}${trail} ${word.toLowerCase()}`;
  } else {
    // Mid-sentence after the first comma if there is one, otherwise prepend.
    const idx = trimmed.indexOf(",");
    if (idx > 0) {
      return `${trimmed.slice(0, idx + 1)} ${word.toLowerCase()}${trimmed.slice(idx + 1)}`;
    }
    return `${word.toLowerCase()} ${trimmed}`;
  }
}

function injectSignatureEmoji(chunk: string, emoji: string, rng: Rng): string {
  const trimmed = chunk.trim();
  if (trimmed.length === 0) return chunk;
  if (/^\[SEND_PHOTO/i.test(trimmed)) return chunk;
  if (chunk.includes(emoji)) return chunk;

  // 70% append, 30% standalone in this chunk.
  if (rng() < 0.7) {
    return `${trimmed} ${emoji}`;
  }
  return `${trimmed} ${emoji}`;
}

function applyStructuralQuirk(
  chunk: string,
  quirk: NonNullable<ChatStyle["signature_quirk"]>,
  rng: Rng,
): string {
  // Don't touch directive lines.
  if (/\[SEND_PHOTO/i.test(chunk)) return chunk;
  // Apply quirk only ~60% of the time so it stays believable.
  if (rng() > 0.6) return chunk;

  switch (quirk) {
    case "geen-punten":
      return chunk.replace(/\.+(\s|$)/g, "$1");
    case "altijd-lowercase":
      return chunk.toLowerCase();
    case "drie-puntjes-eind":
      // Replace final period or add ... if no terminal punctuation.
      if (/[.!?]\s*$/.test(chunk)) {
        return chunk.replace(/[.!?]\s*$/, "...");
      }
      return chunk + "...";
    case "dubbele-vraagteken":
      return chunk.replace(/\?(?!\?)/g, "??");
    case "geen-shift":
      // Remove ALL capitals (lowercase entire chunk).
      return chunk.toLowerCase();
    case "veel-spaties":
      // Add an extra space after commas occasionally.
      return chunk.replace(/,([^\s])/g, ", $1");
    default:
      return chunk;
  }
}

export function applyVoiceFingerprint(
  chunks: string[],
  style: ChatStyle | null | undefined,
  ctx: { ownerUserId: string; peerProfileId: string; messageIndex: number },
): string[] {
  if (!style) return chunks;

  const sigWords = Array.isArray(style.signature_words)
    ? style.signature_words.filter((s): s is string => typeof s === "string" && s.trim().length > 0).slice(0, 3)
    : [];
  const sigEmojis = Array.isArray(style.signature_emojis)
    ? style.signature_emojis.filter((s): s is string => typeof s === "string" && s.trim().length > 0).slice(0, 3)
    : [];
  const sigQuirk = style.signature_quirk;

  if (sigWords.length === 0 && sigEmojis.length === 0 && !sigQuirk) {
    return chunks;
  }

  const seed = toSeed([ctx.ownerUserId, ctx.peerProfileId, String(ctx.messageIndex)]);
  const rng = makeRng(seed);

  // Choose at most ONE signature word and ONE signature emoji per message,
  // injected in DIFFERENT chunks ideally so it doesn't pile up.
  const out = chunks.slice();

  // 35% chance to enforce signature word in this message.
  if (sigWords.length > 0 && rng() < 0.35) {
    const containsAlready = out.some((c) => chunkContainsAny(c, sigWords));
    if (!containsAlready) {
      const word = pick(sigWords, rng)!;
      const targetIdx = Math.floor(rng() * out.length);
      out[targetIdx] = injectSignatureWord(out[targetIdx]!, word, rng);
    }
  }

  // 30% chance to enforce signature emoji.
  if (sigEmojis.length > 0 && rng() < 0.3) {
    const containsAlready = out.some((c) => chunkContainsAnyEmoji(c, sigEmojis));
    if (!containsAlready) {
      const emoji = pick(sigEmojis, rng)!;
      // Pick a chunk that doesn't already end in an emoji.
      const idx = Math.floor(rng() * out.length);
      out[idx] = injectSignatureEmoji(out[idx]!, emoji, rng);
    }
  }

  // Apply quirk to a random chunk (or all if "altijd-lowercase").
  if (sigQuirk) {
    if (sigQuirk === "altijd-lowercase" || sigQuirk === "geen-shift") {
      // Apply to ALL chunks every time — that's literally the persona's voice.
      for (let i = 0; i < out.length; i++) {
        out[i] = applyStructuralQuirk(out[i]!, sigQuirk, () => 0); // force apply
      }
    } else {
      for (let i = 0; i < out.length; i++) {
        out[i] = applyStructuralQuirk(out[i]!, sigQuirk, rng);
      }
    }
  }

  return out;
}

// ---- Default fingerprint pool (legacy personas without explicit v2 fields).
// Picked deterministically from persona id so re-renders stay stable.

const DEFAULT_SIGNATURE_WORDS_POOL: string[][] = [
  ["yo", "wacht", "ofzo"],
  ["hey", "haha", "joh"],
  ["nou", "echt", "btw"],
  ["okeee", "wacht", "lol"],
  ["mss", "trouwens", "jaaa"],
  ["egt", "haha", "ofzo"],
  ["heel kort", "joh", "lol"],
  ["nope", "ja", "ofzo"],
  ["bro", "haha", "uhm"],
  ["hmm", "haha", "okee"],
];

const DEFAULT_SIGNATURE_EMOJI_POOL: string[][] = [
  ["🙈", "😅"],
  ["🥹", "😂"],
  ["😏", "🙃"],
  ["🥲", "😭"],
  ["✨", "🥰"],
  ["😉", "🫶"],
  ["🤭", "😆"],
  ["😬", "🙃"],
  ["🥵", "😏"],
  ["🤍", "🥹"],
];

const DEFAULT_QUIRK_POOL: NonNullable<ChatStyle["signature_quirk"]>[] = [
  "geen-punten",
  "altijd-lowercase",
  "drie-puntjes-eind",
  "dubbele-vraagteken",
  "geen-shift",
];

/** Resolve a fingerprint for a persona, filling unset v2 fields with
 * deterministic defaults derived from the persona id. Lets old personas
 * still get a stable voice without DB backfill. */
export function resolveVoiceFingerprint(
  style: ChatStyle | null | undefined,
  personaId: string,
): ChatStyle {
  const seed = toSeed([personaId, "v2-fingerprint"]);
  const rng = makeRng(seed);

  const out: ChatStyle = { ...(style ?? {}) };

  if (!Array.isArray(out.signature_words) || out.signature_words.length === 0) {
    out.signature_words = DEFAULT_SIGNATURE_WORDS_POOL[Math.floor(rng() * DEFAULT_SIGNATURE_WORDS_POOL.length)];
  }
  if (!Array.isArray(out.signature_emojis) || out.signature_emojis.length === 0) {
    out.signature_emojis = DEFAULT_SIGNATURE_EMOJI_POOL[Math.floor(rng() * DEFAULT_SIGNATURE_EMOJI_POOL.length)];
  }
  if (!out.signature_quirk) {
    out.signature_quirk = DEFAULT_QUIRK_POOL[Math.floor(rng() * DEFAULT_QUIRK_POOL.length)];
  }
  // signature_typo is optional and not auto-seeded — too easy to make it
  // feel artificial across personas.

  return out;
}

/** Render the v2 fingerprint as system-prompt hint lines. The post-process
 * layer enforces them, but giving the model awareness reduces friction. */
export function voiceFingerprintPromptLines(style: ChatStyle | null | undefined): string[] {
  if (!style) return [];
  const out: string[] = [];

  const sigWords = Array.isArray(style.signature_words)
    ? style.signature_words.filter((s): s is string => typeof s === "string" && s.trim().length > 0).slice(0, 3)
    : [];
  if (sigWords.length) {
    out.push(
      `- Signatuur-woorden (gebruik er minstens ÉÉN in ongeveer 1 op de 3 berichten — dit is jouw stem): ${sigWords
        .map((w) => `‘${w}’`)
        .join(", ")}.`,
    );
  }

  const sigEmojis = Array.isArray(style.signature_emojis)
    ? style.signature_emojis.filter((s): s is string => typeof s === "string" && s.trim().length > 0).slice(0, 3)
    : [];
  if (sigEmojis.length) {
    out.push(
      `- Signatuur-emoji (gebruik er max één per bericht, niet elke beurt): ${sigEmojis.join(" ")}.`,
    );
  }

  if (style.signature_quirk) {
    const map: Record<NonNullable<ChatStyle["signature_quirk"]>, string> = {
      "geen-punten": "Schrijft zonder punten aan het einde van zinnen — voelt natuurlijk casual.",
      "altijd-lowercase": "Typt vrijwel alles in lowercase, ook na een punt.",
      "drie-puntjes-eind": "Eindigt regelmatig zinnen met '...' in plaats van een punt.",
      "dubbele-vraagteken": "Gebruikt graag dubbele vraagtekens '??' als ze écht verbaasd of nieuwsgierig is.",
      "geen-shift": "Vermijdt hoofdletters bijna altijd — alsof shift kapot is.",
      "veel-spaties": "Slordige spaties: extra spatie na komma's bijvoorbeeld.",
    };
    out.push(`- Schrijfquirk: ${map[style.signature_quirk]}`);
  }

  return out;
}
