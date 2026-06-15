import type { ChatMessageRow, ChatProfileRow } from "@/lib/chat/map-rows";
import { grokResponsesComplete, type GrokInputMessage } from "@/lib/xai/grok-responses";

function parseChoice(raw: string, max: number): number | null {
  const text = raw.trim();
  const digit = text.match(/\b([123])\b/);
  if (digit) {
    const n = Number(digit[1]);
    if (n >= 1 && n <= max) return n - 1;
  }
  return null;
}

/** Pick the most natural reply from 3 operator suggestions. */
export async function pickBestOperatorSuggestion(input: {
  profile: ChatProfileRow;
  history: ChatMessageRow[];
  suggestions: [string, string, string];
}): Promise<{ ok: true; text: string; index: number } | { ok: false; error: string }> {
  const lastUser = [...input.history].reverse().find((m) => m.sender === "me");
  const lastUserText =
    lastUser?.body?.trim() ||
    (lastUser?.kind === "image" ? "[afbeelding]" : "(geen tekst)");

  const persona = input.profile.display_name?.trim() || "Persona";

  const system: GrokInputMessage = {
    role: "system",
    content:
      "Je beoordeelt 3 kandidaat-antwoorden voor een dating-chat in het Nederlands. " +
      "Kies het antwoord dat het meest klinkt als een echt mens op WhatsApp: kort, natuurlijk, passend bij persona en user-bericht. " +
      "Geen AI-taal, geen therapeut, geen overdreven beleefdheid. " +
      "Antwoord ALLEEN met het cijfer 1, 2 of 3.",
  };

  const user: GrokInputMessage = {
    role: "user",
    content:
      `Persona: ${persona}\n` +
      `Laatste user-bericht: ${lastUserText}\n\n` +
      `Optie 1: ${input.suggestions[0]}\n` +
      `Optie 2: ${input.suggestions[1]}\n` +
      `Optie 3: ${input.suggestions[2]}\n\n` +
      "Welke optie stuur je? (1, 2 of 3)",
  };

  const out = await grokResponsesComplete([system, user], {
    temperature: 0.2,
    maxOutputTokens: 16,
  });

  if (!out.ok) {
    return { ok: false, error: out.error };
  }

  const index = parseChoice(out.text, 3);
  if (index === null) {
    return {
      ok: true,
      text: input.suggestions[0],
      index: 0,
    };
  }

  return {
    ok: true,
    text: input.suggestions[index]!,
    index,
  };
}
