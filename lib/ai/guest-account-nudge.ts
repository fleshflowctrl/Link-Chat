/**
 * When the chatter has no permanent account (guest / anonymous), some bot
 * replies lightly mention creating an account. Not every persona does this;
 * the user's very first bot reply ever always does.
 */

export type GuestAccountNudgeDecision = {
  /** Must appear in the final text (post-process fallback). */
  required: boolean;
  /** Grok is asked to mention it if it fits naturally. */
  prompt: boolean;
  phraseSeed: string;
};

const ACCOUNT_ALREADY_RE =
  /\b(account|registr|aanmeld|inlog|profiel\b.*bewaar|bewaar\b.*gesprek)/i;

/** ~40% of personas ever mention guest accounts (not every bot). */
export function personaMayMentionGuestAccount(peerId: string): boolean {
  let h = 0;
  for (let i = 0; i < peerId.length; i++) {
    h = (Math.imul(h, 31) + peerId.charCodeAt(i)) | 0;
  }
  return (h >>> 0) % 5 < 2;
}

function seededIndex(seed: string, modulo: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(h, 31) + seed.charCodeAt(i)) | 0;
  }
  return (h >>> 0) % modulo;
}

/** Later turns: roughly 1 in 4 eligible replies. */
function laterTurnWantsNudge(
  ownerUserId: string,
  peerId: string,
  turnIndex: number,
): boolean {
  return seededIndex(`${ownerUserId}:${peerId}:${turnIndex}`, 4) === 0;
}

const NUDGE_PHRASES = [
  "oh trouwens — je hebt nog geen account hè? handig om dat zo te doen als je je chats wilt bewaren",
  "je chat nu zonder account — straks even registreren dan blijft dit gesprek bewaard 😊",
  "ik zie dat je nog niet bent aangemeld — geen stress, maar met een account raak je dit niet kwijt",
  "nog geen account? prima om zo te chatten, maar even aanmelden is handig voor je profiel en berichten",
  "kleine tip van mij: maak later ff een account aan, dan kun je hier gewoon verder waar je stopte",
  "je bent nu gast zonder account — registreren kan altijd nog als je alles wilt opslaan",
  "als je dit gesprek wilt houden: even een account aanmaken, nu hoef je niet maar straks wel fijn",
  "haha anyway — nog niet aangemeld? account aanmaken = je chats en profiel blijven staan",
] as const;

export function pickGuestAccountNudgePhrase(seed: string): string {
  return NUDGE_PHRASES[seededIndex(seed, NUDGE_PHRASES.length)];
}

export function replyAlreadyMentionsAccount(text: string): boolean {
  return ACCOUNT_ALREADY_RE.test(text.trim());
}

export function weaveGuestAccountNudge(
  replyText: string,
  phrase: string,
): string {
  const t = replyText.trim();
  if (!t) return phrase;
  if (replyAlreadyMentionsAccount(t)) return t;
  const sep = /[.!?…]$/.test(t) ? " " : ". ";
  return `${t}${sep}${phrase}`;
}

export function decideGuestAccountNudge(args: {
  isGuestUser: boolean;
  ownerUserId: string;
  peerId: string;
  /** Peer turns already in this thread before the reply we're generating. */
  turnIndex: number;
  /** No peer message from any thread yet for this owner. */
  isFirstPeerReplyEver: boolean;
}): GuestAccountNudgeDecision | null {
  if (!args.isGuestUser) return null;

  const eligible = personaMayMentionGuestAccount(args.peerId);
  const seed = `${args.ownerUserId}:${args.peerId}:${args.turnIndex}`;

  if (args.isFirstPeerReplyEver) {
    return { required: true, prompt: true, phraseSeed: seed };
  }

  if (args.turnIndex === 0 && eligible) {
    return { required: true, prompt: true, phraseSeed: seed };
  }

  if (args.turnIndex > 0 && eligible && laterTurnWantsNudge(
    args.ownerUserId,
    args.peerId,
    args.turnIndex,
  )) {
    return { required: false, prompt: true, phraseSeed: seed };
  }

  return null;
}

export function guestAccountNudgePromptLines(
  decision: GuestAccountNudgeDecision,
): string[] {
  if (decision.required) {
    return [
      "",
      "VERPLICHT (natuurlijk in je antwoord verwerken, max één korte zin):",
      "De gebruiker heeft nog geen vast account (alleen gast). Noem dat luchtig —",
      "ze mag chatten, maar met een account blijven profiel en gesprekken bewaard.",
      "Geen reclame-toon; klink als een menselijke aside. Varieer je woorden.",
    ];
  }
  return [
    "",
    "OPTIONEEL (alleen als het echt past, max één korte zin):",
    "Als het natuurlijk voelt: ze heeft nog geen account — registreren helpt om",
    "chats te bewaren. Laat het weg als het de flow breekt.",
  ];
}
