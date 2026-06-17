import type { ChatMessageRow, ChatProfileRow } from "@/lib/chat/map-rows";
import {
  type OperatorSuggestionTone,
  OPERATOR_SUGGESTION_TONES,
} from "@/lib/operator/operator-suggestion-prompt";
import { grokResponsesComplete, type GrokInputMessage } from "@/lib/xai/grok-responses";

const FLIRT_RE =
  /\b(?:jou|je)\s+app(?:en)?\b|\bmet jou\b|\bben je plan\b|\bflirt\b/i;
const COMPLIMENT_RE = /\bje ziet er|ziet er (?:goed|lekker)|mooi\b|\bknap\b/i;
const SERIOUS_RE =
  /\b(?:verdriet|stress|zwaar|moeilijk|alleen|eenzaam|scheiding|overleden)\b/i;

function parseToneChoice(raw: string): OperatorSuggestionTone | null {
  const text = raw.trim().toLowerCase();
  if (/\b1\b|speels|playful/.test(text)) return "playful";
  if (/\b2\b|warm/.test(text)) return "warm";
  if (/\b3\b|direct/.test(text)) return "direct";
  return null;
}

function heuristicTone(userText: string): OperatorSuggestionTone | null {
  if (SERIOUS_RE.test(userText)) return "warm";
  if (FLIRT_RE.test(userText)) return "playful";
  if (COMPLIMENT_RE.test(userText)) return "warm";
  if (userText.includes("?") && userText.length > 40) return "direct";
  return null;
}

/** Pick speels / warm / direct before a single pipeline run (cheap). */
export async function pickOperatorSuggestionTone(input: {
  profile: ChatProfileRow;
  history: ChatMessageRow[];
}): Promise<
  | { ok: true; tone: OperatorSuggestionTone; source: "heuristic" | "grok" }
  | { ok: false; error: string }
> {
  const lastUser = [...input.history].reverse().find((m) => m.sender === "me");
  const lastUserText =
    lastUser?.body?.trim() ||
    (lastUser?.kind === "image" ? "[afbeelding]" : "");

  const guessed = heuristicTone(lastUserText);
  if (guessed) {
    return { ok: true, tone: guessed, source: "heuristic" };
  }

  const persona = input.profile.display_name?.trim() || "Persona";

  const system: GrokInputMessage = {
    role: "system",
    content:
      "Kies de beste toon voor één dating-app antwoord in het Nederlands. " +
      "Antwoord ALLEEN met: speels, warm, of direct.",
  };

  const user: GrokInputMessage = {
    role: "user",
    content:
      `Persona: ${persona}\n` +
      `Laatste user-bericht: ${lastUserText || "(geen tekst)"}\n\n` +
      "Toon (speels / warm / direct):",
  };

  const out = await grokResponsesComplete([system, user], {
    temperature: 0.2,
    maxOutputTokens: 16,
  });

  if (!out.ok) {
    return { ok: true, tone: "warm", source: "heuristic" };
  }

  const tone = parseToneChoice(out.text);
  if (tone && OPERATOR_SUGGESTION_TONES.includes(tone)) {
    return { ok: true, tone, source: "grok" };
  }

  return { ok: true, tone: "warm", source: "heuristic" };
}
