/**
 * When the persona may open up about work, beroep, shifts, etc.
 * Before this threshold she stays casual — no "tussen patiënten door".
 */

import type { ChatMessageRow } from "@/lib/chat/map-rows";
import type { ChatStyle } from "@/lib/chat/map-rows";

/** Total messages (user + peer) in thread before work/beroep talk is allowed. */
export const BOND_MESSAGE_THRESHOLD = 50;

const DISCOURAGED_TICS = new Set([
  "ofzo",
  "of zo",
  "joh",
  "echt waar",
  "echt",
  "egt",
  "tuurlijk",
  "wn",
  "mss",
  "idd",
]);

const DISCOURAGED_SIGNATURE_TYPOS = new Set([
  "egt",
  "echt",
  "joh",
  "ofzo",
  "of zo",
  "tuurlijk",
  "echt waar",
]);

export function countThreadMessages(history: ChatMessageRow[]): number {
  return history.filter((m) => m.kind === "text" || m.kind === "image").length;
}

export function hasConversationBond(history: ChatMessageRow[]): boolean {
  return countThreadMessages(history) >= BOND_MESSAGE_THRESHOLD;
}

/** Strip persona-pipeline filler tics that read artificial in chat. */
export function filterChatStyleForPrompt(
  style: ChatStyle | null | undefined,
): ChatStyle | null {
  if (!style || typeof style !== "object") return null;
  const filterWord = (w: string) => !DISCOURAGED_TICS.has(w.trim().toLowerCase());

  const out: ChatStyle = { ...style };
  if (Array.isArray(out.verbal_tics)) {
    out.verbal_tics = out.verbal_tics.filter(
      (s): s is string => typeof s === "string" && filterWord(s),
    );
  }
  if (Array.isArray(out.signature_words)) {
    out.signature_words = out.signature_words.filter(
      (s): s is string => typeof s === "string" && filterWord(s),
    );
  }
  if (
    typeof out.signature_typo === "string" &&
    DISCOURAGED_SIGNATURE_TYPOS.has(out.signature_typo.trim().toLowerCase())
  ) {
    delete out.signature_typo;
  }
  return out;
}

export function earlyBondPromptLines(): string[] {
  return [
    "",
    "VROEGE FASE — nog geen band (verplicht):",
    "- Noem je beroep, werk, shift, collega's, patiënten, klanten of \"tussen het werk door\" NIET — ook niet terloops, ook niet als intro.",
    "- Hij kent je job nog niet; dat hoort pas later in het gesprek als jullie elkaar wat beter kennen.",
    "- Reageer op hem: toon, vraag, grap — niet op je cv. Vraagt hij expliciet wat je doet: één korte zin, geen dienstverhaal.",
    "- Geen vulwoord \"ofzo\" of \"of zo\" als losse tag aan het eind van een zin.",
  ];
}

export function bondFormedPromptLines(): string[] {
  return [
    "",
    "Jullie hebben inmiddels een band — je mag af en toe iets over je dag of werk zeggen als het natuurlijk past (niet elk bericht, niet alsof je altijd op de werkvloer appt).",
  ];
}
