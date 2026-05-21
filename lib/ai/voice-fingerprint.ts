/**
 * Voice fingerprint — structural quirks only.
 *
 * Forced injection of signature words ("joh", "echt", "ofzo" at the end of a
 * sentence) was removed: it read artificial. Personas may still use verbal
 * tics via the system prompt when configured in `chat_style`; post-process
 * only applies optional structural quirks (lowercase, no periods, etc.).
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

function applyStructuralQuirk(
  chunk: string,
  quirk: NonNullable<ChatStyle["signature_quirk"]>,
  rng: Rng,
): string {
  if (/\[SEND_PHOTO/i.test(chunk)) return chunk;
  if (rng() > 0.6) return chunk;

  switch (quirk) {
    case "geen-punten":
      return chunk.replace(/\.+(\s|$)/g, "$1");
    case "altijd-lowercase":
      return chunk.toLowerCase();
    case "drie-puntjes-eind":
      if (/[.!?]\s*$/.test(chunk)) {
        return chunk.replace(/[.!?]\s*$/, "...");
      }
      return chunk + "...";
    case "dubbele-vraagteken":
      return chunk.replace(/\?(?!\?)/g, "??");
    case "geen-shift":
      return chunk.toLowerCase();
    case "veel-spaties":
      return chunk.replace(/,([^\s])/g, ", $1");
    default:
      return chunk;
  }
}

export function applyVoiceFingerprint(
  chunks: string[],
  style: ChatStyle | null | undefined,
  ctx: {
    ownerUserId: string;
    peerProfileId: string;
    messageIndex: number;
    skipSignatureInjection?: boolean;
  },
): string[] {
  if (!style?.signature_quirk) return chunks;

  const seed = toSeed([ctx.ownerUserId, ctx.peerProfileId, String(ctx.messageIndex)]);
  const rng = makeRng(seed);
  const sigQuirk = style.signature_quirk;
  const out = chunks.slice();

  if (sigQuirk === "altijd-lowercase" || sigQuirk === "geen-shift") {
    for (let i = 0; i < out.length; i++) {
      out[i] = applyStructuralQuirk(out[i]!, sigQuirk, () => 0);
    }
  } else {
    for (let i = 0; i < out.length; i++) {
      out[i] = applyStructuralQuirk(out[i]!, sigQuirk, rng);
    }
  }

  return out;
}

const DEFAULT_QUIRK_POOL: NonNullable<ChatStyle["signature_quirk"]>[] = [
  "geen-punten",
  "altijd-lowercase",
  "drie-puntjes-eind",
  "dubbele-vraagteken",
  "geen-shift",
];

/** Resolve persona chat_style; no auto-seeded signature word lists. */
export function resolveVoiceFingerprint(
  style: ChatStyle | null | undefined,
  personaId: string,
): ChatStyle {
  const seed = toSeed([personaId, "v2-fingerprint"]);
  const rng = makeRng(seed);
  const out: ChatStyle = { ...(style ?? {}) };

  if (!out.signature_quirk) {
    out.signature_quirk = DEFAULT_QUIRK_POOL[Math.floor(rng() * DEFAULT_QUIRK_POOL.length)];
  }

  return out;
}

/** Optional prompt hints — never mandate filler words at sentence end. */
export function voiceFingerprintPromptLines(style: ChatStyle | null | undefined): string[] {
  if (!style) return [];
  const out: string[] = [];

  const sigWords = Array.isArray(style.signature_words)
    ? style.signature_words.filter((s): s is string => typeof s === "string" && s.trim().length > 0).slice(0, 3)
    : [];
  if (sigWords.length) {
    out.push(
      `- Woorden die bij jouw stem kunnen passen (alleen als het natuurlijk in de zin valt — nooit los erachter plakken): ${sigWords
        .map((w) => `‘${w}’`)
        .join(", ")}.`,
    );
  }

  const sigEmojis = Array.isArray(style.signature_emojis)
    ? style.signature_emojis.filter((s): s is string => typeof s === "string" && s.trim().length > 0).slice(0, 3)
    : [];
  if (sigEmojis.length) {
    out.push(
      `- Emoji die bij jou passen (max één per bericht, niet elke beurt): ${sigEmojis.join(" ")}.`,
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

  out.push(
    "- Geen stopwoordjes of vulwoorden als losse tag aan het eind van een zin (niet: \"… prima joh\", \"… echt\", \"… ofzo\"). Als je ze gebruikt, moeten ze ín de zin horen.",
  );

  return out;
}
