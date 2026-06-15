import type { ChatMessageRow, ChatProfileRow } from "@/lib/chat/map-rows";
import { grokResponsesComplete, type GrokInputMessage } from "@/lib/xai/grok-responses";

const MAX_MESSAGES = 24;

function formatHistory(
  rows: ChatMessageRow[],
  peerName: string,
): string {
  const tail = rows.slice(-MAX_MESSAGES);
  if (!tail.length) return "(nog geen berichten)";
  return tail
    .map((m) => {
      const who = m.sender === "me" ? "USER" : peerName.toUpperCase();
      const body =
        m.body?.trim() ||
        (m.kind === "image" ? "[afbeelding]" : m.kind === "gift" ? "[gift]" : "—");
      return `${who}: ${body}`;
    })
    .join("\n");
}

function parseSuggestions(raw: string): string[] {
  const text = raw.trim();
  if (!text) return [];

  const tryParse = (candidate: string): string[] | null => {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (Array.isArray(parsed)) {
        return parsed
          .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
          .map((v) => v.trim())
          .slice(0, 3);
      }
      if (
        parsed &&
        typeof parsed === "object" &&
        Array.isArray((parsed as { suggestions?: unknown }).suggestions)
      ) {
        return ((parsed as { suggestions: unknown[] }).suggestions ?? [])
          .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
          .map((v) => v.trim())
          .slice(0, 3);
      }
    } catch {
      /* try next */
    }
    return null;
  };

  const direct = tryParse(text);
  if (direct?.length) return direct;

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    const fromFence = tryParse(fenced[1].trim());
    if (fromFence?.length) return fromFence;
  }

  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    const fromArray = tryParse(arrayMatch[0]);
    if (fromArray?.length) return fromArray;
  }

  return text
    .split(/\n+/)
    .map((line) => line.replace(/^\s*\d+[\).\]]\s*/, "").trim())
    .filter((line) => line.length > 0)
    .slice(0, 3);
}

export async function generateOperatorReplySuggestions(input: {
  profile: ChatProfileRow;
  history: ChatMessageRow[];
}): Promise<
  | { ok: true; suggestions: [string, string, string]; model: string }
  | { ok: false; error: string }
> {
  const peerName = input.profile.display_name?.trim() || "Persona";
  const lastUser = [...input.history].reverse().find((m) => m.sender === "me");
  const lastUserText =
    lastUser?.body?.trim() ||
    (lastUser?.kind === "image" ? "[afbeelding]" : "");

  const system: GrokInputMessage = {
    role: "system",
    content:
      "Je helpt een menselijke chat-operator die namens een dating-persona antwoordt in het Nederlands. " +
      "Geef precies 3 korte antwoord-opties op de laatste user-bericht. " +
      "Elke optie is 1–3 zinnen, chattoon, warm en natuurlijk, passend bij de persona. " +
      "Maak de 3 opties duidelijk verschillend (bijv. speels / warm / direct). " +
      "Geen uitleg, geen markdown, geen nummering — alleen JSON: " +
      '{"suggestions":["...","...","..."]}',
  };

  const user: GrokInputMessage = {
    role: "user",
    content:
      `Persona: ${peerName}\n` +
      (input.profile.bio?.trim() ? `Bio: ${input.profile.bio.trim()}\n` : "") +
      (lastUserText ? `Laatste user-bericht: ${lastUserText}\n\n` : "") +
      `Gesprek:\n${formatHistory(input.history, peerName)}`,
  };

  const out = await grokResponsesComplete([system, user], {
    temperature: 0.72,
    maxOutputTokens: 700,
  });

  if (!out.ok) {
    return { ok: false, error: out.error };
  }

  let suggestions = parseSuggestions(out.text);
  if (suggestions.length < 3) {
    return {
      ok: false,
      error: "Kon geen 3 suggesties genereren",
    };
  }

  suggestions = suggestions.slice(0, 3);
  return {
    ok: true,
    suggestions: [suggestions[0]!, suggestions[1]!, suggestions[2]!],
    model: out.model,
  };
}
