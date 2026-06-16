import type { ChatMessageRow } from "@/lib/chat/map-rows";
import type { SavedOperatorSummary } from "@/lib/operator/saved-summary";

export type OperatorSuggestionTone = "playful" | "warm" | "direct";

export const OPERATOR_SUGGESTION_TONES: OperatorSuggestionTone[] = [
  "playful",
  "warm",
  "direct",
];

const TONE_APPEND: Record<OperatorSuggestionTone, string> = {
  playful:
    "\n\nOPERATOR-SUGGESTIE (speels): Schrijf één WhatsApp-bericht van 1-3 zinnen. Plagerig, licht uitdagend, met persoonlijk detail uit het gesprek. Toon interesse — niet kil. Geen AI-taal.",
  warm:
    "\n\nOPERATOR-SUGGESTIE (warm): Schrijf één bericht van 1-3 zinnen — zacht, oprecht, menselijk. Laat merken dat je meeleest. Geen therapeut of klantenservice.",
  direct:
    "\n\nOPERATOR-SUGGESTIE (direct): Schrijf één helder bericht van 1-3 zinnen op zijn punt. Warm en betrokken — geen telegrafische eenliner. Geen standaardinterviewvraag, maar een echte vraag mag als het natuurlijk past.",
};

export function operatorSuggestionToneAppend(
  tone: OperatorSuggestionTone,
): string {
  return TONE_APPEND[tone];
}

const OPERATOR_ENGAGEMENT_BLOCK =
  "\n\nOPERATOR-ENGAGEMENT: Schrijf 1-3 zinnen die warm en betrokken klinken — niet afstandelijk of ongeïnteresseerd. " +
  "Niet elke beurt een vraag, maar als er een natuurlijk haakje is in zijn bericht: één concrete vraag over dat detail. " +
  "Geen 'en jij?', geen generieke dag-vragen, geen doorvraag-storm.";

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

  let block = "";
  if (parts.length) {
    block =
      "\n\n" +
      parts.join("\n\n") +
      "\n\nGebruik dit alleen als achtergrond — verzin geen nieuwe feiten over de user.";
  }
  return block + OPERATOR_ENGAGEMENT_BLOCK;
}

/** Hint for pick-best: should we prefer a reply with a follow-up question? */
export function computeOperatorQuestionHint(history: ChatMessageRow[]): {
  shouldEncourageQuestion: boolean;
  hint: string;
} {
  const lastUser = [...history].reverse().find((m) => m.sender === "me");
  const lastUserText = lastUser?.body?.trim() ?? "";
  const recentPeer = history
    .filter((m) => m.sender === "peer")
    .slice(-3)
    .map((m) => m.body ?? "");
  const peerQuestionsRecent = recentPeer.filter((b) => b.includes("?")).length;
  const userShortDismissive =
    /^(?:ok(?:é|e|ay)?|ja|jaa|haha|hehe|lol|hm+|mm+)\.?$/i.test(lastUserText);
  const userSubstantive = lastUserText.length >= 25;

  const shouldEncourageQuestion =
    !userShortDismissive &&
    peerQuestionsRecent < 2 &&
    (userSubstantive || lastUserText.includes("?"));

  const hint = shouldEncourageQuestion
    ? "Voorkeur voor een optie die interesse toont — mag één concrete vraag over iets uit zijn bericht."
    : "Geen verplichte vraag; een warme reactie zonder vraag is ook goed.";

  return { shouldEncourageQuestion, hint };
}
