/**
 * When the chatter has no permanent account (guest / anonymous), some bot
 * replies express a personal boundary: she prefers chatting with someone who
 * has a real profile (trust, name, photo) — not an app tip about saving chats.
 */

export type GuestAccountNudgeDecision = {
  /** Must appear in the final text (post-process fallback). */
  required: boolean;
  /** Grok is asked to mention it if it fits naturally. */
  prompt: boolean;
  phraseSeed: string;
};

const TRUST_BOUNDARY_ALREADY_RE =
  /\b(account|registr|aanmeld|profiel|gast\b|zonder\s+account|weet\s+niet\s+(wie|hoe\s+je\s+heet)|hoe\s+je\s+heet|eruit\s*ziet|vertrouw|voorzichtig|liever\s+niet\s+chat)/i;

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
  "ik chat eigenlijk liever niet zo zonder profiel — ik weet niet eens hoe je heet of hoe je eruitziet, snap je?",
  "hoi hoor, ik ben een beetje voorzichtig met gasten zonder account… ik zie je profiel niet en dat voelt raar voor mij",
  "sorry als dit direct klinkt maar ik praat liever met iemand met een profiel, anders weet ik niet met wie ik bezig ben",
  "ik ben best open maar zonder account/profiel voel ik me niet lekker — geen foto, geen naam, dat is voor mij lastig vertrouwen",
  "niks tegen jou hoor, maar ik chat liever niet te ver zonder profiel… ik kan je nu niet eens zien of je naam checken",
  "ik vertrouw het pas als ik iemand een beetje ken — zonder account weet ik niet wie je bent en dat houdt me tegen",
  "echt waar, ik ben niet zo van chatten met iemand zonder profiel, ik zie niet hoe je eruitziet en weet je naam niet",
  "ik wil wel reageren maar ik voel me ongemakkelijk zonder profiel — voor mij is dat een vertrouwensding, niet persoonlijk bedoeld",
] as const;

export function pickGuestAccountNudgePhrase(seed: string): string {
  return NUDGE_PHRASES[seededIndex(seed, NUDGE_PHRASES.length)];
}

export function replyAlreadyMentionsGuestBoundary(text: string): boolean {
  return TRUST_BOUNDARY_ALREADY_RE.test(text.trim());
}

/** @deprecated Use replyAlreadyMentionsGuestBoundary */
export function replyAlreadyMentionsAccount(text: string): boolean {
  return replyAlreadyMentionsGuestBoundary(text);
}

export function weaveGuestAccountNudge(
  replyText: string,
  phrase: string,
): string {
  const t = replyText.trim();
  if (!t) return phrase;
  if (replyAlreadyMentionsGuestBoundary(t)) return t;
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

  if (
    args.turnIndex > 0 &&
    eligible &&
    laterTurnWantsNudge(args.ownerUserId, args.peerId, args.turnIndex)
  ) {
    return { required: false, prompt: true, phraseSeed: seed };
  }

  return null;
}

export function guestAccountNudgePromptLines(
  decision: GuestAccountNudgeDecision,
): string[] {
  const trustBlock = [
    "Zij heeft nog geen echt profiel/account (alleen gast) — jij ziet geen foto, geen naam, geen profiel.",
    "Geen app-uitleg of tip over 'chats bewaren' of 'registreren'.",
    "Wel: jouw persoonlijke voorkeur/grens — je voelt je niet lekker verder chatten zonder profiel",
    "omdat je niet weet wie ze is, niet ziet hoe ze eruitziet, en haar naam niet kent (vertrouwen).",
    "Vriendelijk en menselijk, niet salesy of streng. Je mag nog wel op haar bericht reageren.",
  ];

  if (decision.required) {
    return [
      "",
      "VERPLICHT (natuurlijk in je antwoord verwerken, max één tot twee korte zinnen):",
      ...trustBlock,
      "Varieer je formulering; klink als iets wat jij echt voelt, niet als systeemtekst.",
    ];
  }
  return [
    "",
    "OPTIONEEL (alleen als het echt past, max één korte zin):",
    ...trustBlock,
    "Laat het weg als het de flow breekt.",
  ];
}
