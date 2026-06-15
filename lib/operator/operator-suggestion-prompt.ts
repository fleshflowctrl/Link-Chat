import type { SavedOperatorSummary } from "@/lib/operator/saved-summary";

export type OperatorSuggestionTone = "playful" | "warm" | "direct";

export const OPERATOR_SUGGESTION_TONES: OperatorSuggestionTone[] = [
  "playful",
  "warm",
  "direct",
];

const TONE_APPEND: Record<OperatorSuggestionTone, string> = {
  playful:
    "\n\nOPERATOR-SUGGESTIE (speels): Schrijf één kort WhatsApp-bericht. Plagerig, licht uitdagend, met persoonlijk detail uit het gesprek. Geen AI-taal.",
  warm:
    "\n\nOPERATOR-SUGGESTIE (warm): Schrijf één kort bericht — zacht, oprecht, menselijk. Geen therapeut of klantenservice.",
  direct:
    "\n\nOPERATOR-SUGGESTIE (direct): Schrijf één kort, helder antwoord op zijn punt. Geen omwegen, geen geforceerde vraag aan het eind.",
};

export function operatorSuggestionToneAppend(
  tone: OperatorSuggestionTone,
): string {
  return TONE_APPEND[tone];
}

export function buildOperatorSuggestionContextBlock(input: {
  savedSummary?: SavedOperatorSummary | null;
  threadMemorySummary?: string | null;
}): string {
  const parts: string[] = [];
  if (input.savedSummary?.summary?.trim()) {
    parts.push(
      `Operator-notities (Samenvatting in inbox):\n${input.savedSummary.summary.trim()}`,
    );
  }
  if (input.threadMemorySummary?.trim()) {
    parts.push(`Thread-geheugen:\n${input.threadMemorySummary.trim()}`);
  }
  if (!parts.length) return "";
  return (
    "\n\n" +
    parts.join("\n\n") +
    "\n\nGebruik dit alleen als achtergrond — verzin geen nieuwe feiten over de user."
  );
}
