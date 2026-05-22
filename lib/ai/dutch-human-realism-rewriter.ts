/**
 * Output cleanup: rewrite Grok replies toward casual Dutch dating-app chat.
 * Runs after the main Grok call (and optional draft-revise), before split/post-process.
 */

import { MULTI_MESSAGE_SEPARATOR } from "@/lib/ai/post-process-reply";

export type DutchHumanRealismPersona = {
  name: string;
  age?: number | null;
  city?: string | null;
  /** e.g. short | medium | variable from chat_style */
  replyLength?: string | null;
  mood?: string | null;
  bondStage?: string | null;
};

export type DutchHumanRealismTimeContext = {
  clockText?: string;
  timeOfDay?: string;
  weekday?: string;
  energyState?: string;
};

export type DutchHumanRealismInput = {
  rawModelResponse: string;
  userMessage: string;
  lastBotMessages: string[];
  persona: DutchHumanRealismPersona;
  timeContext?: DutchHumanRealismTimeContext;
  /** low | medium | high | explicit — dampens flirt rewrite when user is casual */
  userFlirtLevel?: "low" | "medium" | "high" | "explicit";
  allowMultiMessage?: boolean;
  terseMode?: boolean;
};

export type DutchHumanRealismResult = {
  text: string;
  realismScore: number;
  rewriteApplied: boolean;
  issues: string[];
};

const GENERIC_PHRASE_RES: Array<{ re: RegExp; label: string }> = [
  { re: /\bfijne start van de dag\b/gi, label: "fijne start van de dag" },
  { re: /\bwat een rustige start\b/gi, label: "wat een rustige start" },
  { re: /\bhoe gaat (?:jouw|je|uw) dag\b/gi, label: "hoe gaat jouw dag" },
  { re: /\bklinkt gezellig\b/gi, label: "klinkt gezellig" },
  { re: /\bhaha[,!]?\s*leuk\b/gi, label: "haha leuk" },
  { re: /\b(?:wat\s+)?(?:een\s+)?leuke?\s+(?:start|ochtend|avond)\b/gi, label: "leuke start/ochtend" },
  { re: /\bik hoop dat (?:je|jouw) dag\b/gi, label: "ik hoop dat je dag" },
  { re: /\b(?:fijn|mooi) dat je (?:even )?appt\b/gi, label: "fijn dat je appt" },
  {
    re: /\b(?:dat\s+)?klinkt (?:heel\s+)?(?:leuk|mooi|gezellig|interessant)\b/gi,
    label: "klinkt leuk",
  },
  { re: /\b(?:wat\s+)?(?:een\s+)?(?:mooi|fijn|leuk) idee\b/gi, label: "mooi idee" },
  {
    re: /\bgoedemorgen[,!]?\s*(?:wat\s+)?(?:een\s+)?(?:fijne|mooie|rustige)\b/gi,
    label: "goedemorgen + generic",
  },
  {
    re: /\b(?:ik\s+)?(?:ben\s+)?(?:benieuwd|nieuwsgierig)\s+(?:wat|hoe)\s+jij\b/gi,
    label: "benieuwd wat jij",
  },
];

const SERVICE_PHRASE_RES: Array<{ re: RegExp; label: string }> = [
  { re: /\bhoe kan ik je helpen\b/gi, label: "hoe kan ik je helpen" },
  { re: /\bik begrijp hoe je je voelt\b/gi, label: "ik begrijp hoe je je voelt" },
  { re: /\bik ben hier voor je\b/gi, label: "ik ben hier voor je" },
  { re: /\bsorry[,!]?\s*dat was niet mijn bedoeling\b/gi, label: "sorry niet mijn bedoeling" },
  { re: /\b(?:mijn\s+)?excuses\b/gi, label: "excuses" },
  { re: /\bdat klinkt (?:heel\s+)?lastig\b/gi, label: "dat klinkt lastig" },
  { re: /\b(?:ik\s+)?help je graag\b/gi, label: "help je graag" },
  { re: /\bzoals jij wilt\b/gi, label: "zoals jij wilt" },
  { re: /\bgeen probleem[,!]?\s*(?:hoor|hè)?\b/gi, label: "geen probleem" },
  {
    re: /\b(?:natuurlijk|zeker)[,!]?\s*(?:dat\s+)?(?:kan|doe)\s+ik\b/gi,
    label: "natuurlijk dat kan ik",
  },
];

const GREETING_RE =
  /^(hoi|hey|heyy|hallo|ha|hoii|hee|goedemorgen|goedenavond|goedenmiddag|goeie\s*(?:morgen|avond|middag))\b/i;

const EMOJI_RE = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]/g;

function seedBit(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % 2;
}

function normalize(s: string): string {
  return s.replace(/\r\n/g, "\n").trim();
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[.,!?;:()"'\u2018\u2019\u201C\u201D]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function isSimpleUserMessage(user: string): boolean {
  const u = user.trim();
  if (!u) return true;
  if (u.length <= 28) return true;
  if (/^(hoi|hey|hallo|ha|goedemorgen|goedenavond|hoe gaat|wat doe|ok|oke|ja|nee|lol|haha)\b/i.test(u)) {
    return true;
  }
  return u.split(/\s+/).length <= 5;
}

function userIsCasualOnly(user: string): boolean {
  const u = user.trim().toLowerCase();
  if (!u) return true;
  if (/flirt|sexy|naakt|verleid|kus|zoen|heet/i.test(u)) return false;
  return isSimpleUserMessage(user);
}

function extractRepeatedOpeners(
  text: string,
  lastBotMessages: string[],
): string[] {
  const issues: string[] = [];
  const lower = text.toLowerCase();
  for (const prev of lastBotMessages.slice(0, 4)) {
    const p = prev.trim().toLowerCase();
    if (!p || p.length < 12) continue;
    const opener = p.slice(0, Math.min(40, p.length));
    if (lower.startsWith(opener.slice(0, 18))) {
      issues.push("repeats_previous_opener");
      return issues;
    }
    const tokens = tokenize(prev);
    for (let n = 4; n >= 3; n--) {
      if (tokens.length < n) continue;
      const gram = tokens.slice(0, n).join(" ");
      if (gram.length >= 10 && lower.includes(gram)) {
        issues.push(`repeats_phrase:${gram}`);
      }
    }
  }
  return issues;
}

function scoreRealism(text: string, input: DutchHumanRealismInput): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 100;
  const t = text.trim();
  const user = input.userMessage.trim();

  for (const { re, label } of GENERIC_PHRASE_RES) {
    if (re.test(t)) {
      issues.push(`generic:${label}`);
      score -= 14;
    }
    re.lastIndex = 0;
  }

  for (const { re, label } of SERVICE_PHRASE_RES) {
    if (re.test(t)) {
      issues.push(`service:${label}`);
      score -= 22;
    }
    re.lastIndex = 0;
  }

  issues.push(...extractRepeatedOpeners(t, input.lastBotMessages));

  if (issues.some((i) => i.startsWith("repeats_"))) score -= 18;

  const userGreet = GREETING_RE.exec(user);
  const botGreet = GREETING_RE.exec(t);
  if (userGreet && botGreet) {
    issues.push("double_greeting");
    score -= 20;
  }

  if (isSimpleUserMessage(user) && t.length > Math.max(40, user.length * 3)) {
    issues.push("too_long_for_simple_user");
    score -= 16;
  }

  const emojiCount = (t.match(EMOJI_RE) ?? []).length;
  if (t.length < 100 && emojiCount > 1) {
    issues.push("too_many_emoji");
    score -= 12;
  }

  const hahaCount = (t.match(/\bhaha+h?\b/gi) ?? []).length;
  if (hahaCount > 1) {
    issues.push("haha_spam");
    score -= 8;
  }

  if (/\begt\b/i.test(t)) {
    issues.push("forced_egt");
    score -= 10;
  }

  if (/\bff\b/i.test(t) && !/\bff\s+(gaan|kijken|eten|bellen)\b/i.test(t)) {
    issues.push("forced_ff");
    score -= 6;
  }

  if ((t.match(/\uD83D[\uDE00-\uDE4F]/g) ?? []).length + (t.includes("😭") ? 1 : 0) > 0 && /\b😭\b/.test(t)) {
    issues.push("cry_emoji");
    score -= 4;
  }

  if (
    /^[A-ZÀ-Ý][^.!?]{40,}[.!?]\s*$/.test(t) &&
    !/\b(lol|haha|ff|tbh|idk|wtf|nah)\b/i.test(t)
  ) {
    issues.push("too_neat_paragraph");
    score -= 10;
  }

  if (
    userIsCasualOnly(user) &&
    (input.userFlirtLevel === "low" || !input.userFlirtLevel) &&
    /\b(?:verleidelijk|heet|sexy|naakt|kus me|kom bij me)\b/i.test(t)
  ) {
    issues.push("over_flirty_for_casual");
    score -= 12;
  }

  return { score: Math.max(0, Math.min(100, score)), issues };
}

function stripGenericPhrases(text: string): string {
  let s = text;
  for (const { re } of GENERIC_PHRASE_RES) {
    s = s.replace(re, " ");
    re.lastIndex = 0;
  }
  return s.replace(/\s{2,}/g, " ").replace(/^[,.!?\s]+/, "").trim();
}

function stripServiceTone(text: string, user: string): string {
  let s = text;
  for (const { re } of SERVICE_PHRASE_RES) {
    s = s.replace(re, " ");
    re.lastIndex = 0;
  }
  s = s.trim();
  if (/je reageert wel droog/i.test(user)) {
    s = s
      .replace(/\bsorry\b/gi, "")
      .replace(/\bniet mijn bedoeling\b/gi, "")
      .trim();
    if (!s) return "hahaha wow meteen aangevallen";
  }
  return s.replace(/\s{2,}/g, " ").trim();
}

function fixDoubleGreeting(text: string, userMessage: string): string {
  const user = userMessage.trim();
  const userMatch = GREETING_RE.exec(user);
  if (!userMatch) return text;

  let s = text.trim();
  const botMatch = GREETING_RE.exec(s);
  if (!botMatch) return s;

  const userWord = userMatch[1].toLowerCase();
  const botWord = botMatch[1].toLowerCase();
  const sameFamily =
    userWord === botWord ||
    (["hoi", "hey", "heyy", "hallo", "ha", "hoii", "hee"].includes(userWord) &&
      ["hoi", "hey", "heyy", "hallo", "ha", "hoii", "hee"].includes(botWord));

  if (!sameFamily && !s.toLowerCase().startsWith(userWord)) return s;

  s = s.replace(GREETING_RE, "").replace(/^[,!.\s]+/, "").trim();
  if (!s) {
    if (/goedemorgen/i.test(user)) return "goedemorgen trouwens";
    if (/goedenavond/i.test(user)) return "goedenavond jij";
    return "heyy";
  }
  return s;
}

function stripRepeatedFromLastBot(text: string, lastBotMessages: string[]): string {
  let s = text;
  for (const prev of lastBotMessages.slice(0, 3)) {
    const tokens = tokenize(prev);
    for (let n = 5; n >= 3; n--) {
      if (tokens.length < n) continue;
      const gram = tokens.slice(0, n).join("\\s+");
      const re = new RegExp(`^${gram}[,.!?\\s]*`, "i");
      if (re.test(s)) {
        s = s.replace(re, "").trim();
      }
    }
  }
  return s.trim();
}

function undoForcedAbbrevs(text: string): string {
  return text
    .replace(/\begt\b/gi, "echt")
    .replace(/\bwn\b/gi, "weet niet")
    .replace(/\bies\b/gi, "iets")
    .replace(/\bvandag\b/gi, "vandaag");
}

function reduceEmoji(text: string, max: number): string {
  let count = 0;
  return text.replace(EMOJI_RE, (m) => {
    count += 1;
    return count <= max ? m : "";
  });
}

function reduceHaha(text: string): string {
  let seen = false;
  return text.replace(/\bhaha+h?\b/gi, (m) => {
    if (seen) return "";
    seen = true;
    return m.length > 4 ? "haha" : m;
  });
}

function shortenForSimpleUser(text: string, userMessage: string): string {
  const user = userMessage.trim();
  if (!isSimpleUserMessage(user)) return text;
  const maxLen = Math.max(28, Math.min(140, user.length * 3 + 20));
  if (text.length <= maxLen) return text;

  const sentences = text.split(/(?<=[.!?…])\s+/).filter(Boolean);
  if (sentences.length > 1) {
    return sentences.slice(0, 2).join(" ").trim();
  }

  const cut = text.slice(0, maxLen);
  const sp = cut.lastIndexOf(" ");
  return (sp > 20 ? cut.slice(0, sp) : cut).replace(/[,.;:!?\s]+$/, "").trim();
}

function templateFallback(userMessage: string): string | null {
  const u = userMessage.trim().toLowerCase();
  if (/^hoi\b|^hey\b|^hallo\b/.test(u)) return "heyy";
  if (/^hoe gaat/.test(u)) return "gaat wel eigenlijk";
  if (/droog/.test(u)) return "misschien bén ik ook droog";
  if (/altijd zo flirterig/.test(u)) return "alleen als iemand het een beetje verdient";
  return null;
}

function maybeSplitBubbles(
  text: string,
  input: DutchHumanRealismInput,
): string {
  if (input.terseMode || input.allowMultiMessage === false) return text;
  if (text.includes(MULTI_MESSAGE_SEPARATOR)) return text;

  const parts = text
    .split(/(?<=[.!?…])\s+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (parts.length < 2) return text;
  if (text.length < 70) return text;
  if (!userIsCasualOnly(input.userMessage) && parts.length < 3) return text;

  const cap = parts.length > 3 ? parts.slice(0, 3) : parts;
  return cap.join(`\n${MULTI_MESSAGE_SEPARATOR}\n`);
}

function softenFlirtIfNeeded(text: string, input: DutchHumanRealismInput): string {
  if (!userIsCasualOnly(input.userMessage)) return text;
  if (input.userFlirtLevel === "high" || input.userFlirtLevel === "explicit") {
    return text;
  }
  return text
    .replace(/\b(?:heel\s+)?(?:geil|heet|sexy)\b/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function casualizeSurface(text: string, seed: string): string {
  let s = text.trim();
  if (!s) return s;
  if (seedBit(seed + ":lower") === 0 && /^[A-ZÀ-Ý]/.test(s) && s.length > 4) {
    s = s[0].toLowerCase() + s.slice(1);
  }
  if (seedBit(seed + ":dot") === 0 && /\.$/.test(s) && !/\.\.\./.test(s) && s.length < 120) {
    s = s.replace(/\.$/, "");
  }
  return s.trim();
}

/**
 * Rewrite raw Grok output toward human Dutch chat. May insert <<<>>> separators.
 */
export function rewriteDutchHumanRealism(
  input: DutchHumanRealismInput,
): DutchHumanRealismResult {
  const original = normalize(input.rawModelResponse);
  if (!original) {
    return {
      text: "",
      realismScore: 0,
      rewriteApplied: false,
      issues: ["empty"],
    };
  }

  const before = scoreRealism(original, input);
  let text = original;
  const applied: string[] = [];

  if (before.issues.some((i) => i.startsWith("generic:"))) {
    text = stripGenericPhrases(text);
    applied.push("strip_generic");
  }

  if (before.issues.some((i) => i.startsWith("service:"))) {
    text = stripServiceTone(text, input.userMessage);
    applied.push("strip_service");
  }

  if (before.issues.includes("double_greeting")) {
    text = fixDoubleGreeting(text, input.userMessage);
    applied.push("fix_double_greeting");
  }

  if (before.issues.some((i) => i.startsWith("repeats_"))) {
    text = stripRepeatedFromLastBot(text, input.lastBotMessages);
    applied.push("strip_repetition");
  }

  if (before.issues.includes("too_long_for_simple_user")) {
    text = shortenForSimpleUser(text, input.userMessage);
    applied.push("shorten");
  }

  if (
    before.issues.includes("forced_egt") ||
    before.issues.includes("forced_ff")
  ) {
    text = undoForcedAbbrevs(text);
    applied.push("undo_forced_abbrev");
  }

  if (before.issues.includes("too_many_emoji") || before.issues.includes("cry_emoji")) {
    text = reduceEmoji(text, 1);
    applied.push("reduce_emoji");
  }

  if (before.issues.includes("haha_spam")) {
    text = reduceHaha(text);
    applied.push("reduce_haha");
  }

  if (before.issues.includes("over_flirty_for_casual")) {
    text = softenFlirtIfNeeded(text, input);
    applied.push("soften_flirt");
  }

  if (/\begt\b/i.test(text) || /\bwn\b/i.test(text)) {
    text = undoForcedAbbrevs(text);
    if (!applied.includes("undo_forced_abbrev")) applied.push("undo_forced_abbrev");
  }
  if ((text.match(/\bhaha+h?\b/gi) ?? []).length > 1) {
    text = reduceHaha(text);
    if (!applied.includes("reduce_haha")) applied.push("reduce_haha");
  }
  const emojiN = (text.match(EMOJI_RE) ?? []).length;
  if (emojiN > (text.length < 90 ? 1 : 2)) {
    text = reduceEmoji(text, text.length < 90 ? 1 : 2);
    if (!applied.includes("reduce_emoji")) applied.push("reduce_emoji");
  }
  text = softenFlirtIfNeeded(text, input);

  if (!text.trim() || text.length < 3) {
    const fallback = templateFallback(input.userMessage);
    if (fallback) {
      text = fallback;
      applied.push("template_fallback");
    } else {
      text = original;
      applied.push("revert_empty");
    }
  }

  if (before.score < 60 || applied.length > 0) {
    text = casualizeSurface(text, input.userMessage + input.persona.name);
    if (applied.length > 0 || before.score < 60) {
      text = maybeSplitBubbles(text, input);
      if (text.includes(MULTI_MESSAGE_SEPARATOR)) applied.push("split_bubbles");
    }
  }

  const after = scoreRealism(text, input);
  const rewriteApplied = text.trim() !== original.trim();

  const result: DutchHumanRealismResult = {
    text: text.trim(),
    realismScore: after.score,
    rewriteApplied,
    issues: Array.from(new Set(before.issues.concat(after.issues))),
  };

  logDutchHumanRealismDev({
    original,
    final: result.text,
    realismScore: result.realismScore,
    rewriteApplied: result.rewriteApplied,
    issues: result.issues,
    applied,
    scoreBefore: before.score,
  });

  return result;
}

/** Trailing persona filler words injected by old pipelines or the model. */
const TRAILING_PROFILE_FILLER =
  /(?:^|\s|\.{2,})(egt|joh|ofzo|of\s+zo|tuurlijk|idd|mss|echt\s+waar)(?:[.!?…]*)?\s*$/i;

/** Light pass — strips filler abbrevs, trailing "egt", emoji/haha spam. */
export function polishRealismChunk(
  chunk: string,
  opts?: { maxEmoji?: number },
): string {
  if (!chunk.trim()) return chunk;
  let s = undoForcedAbbrevs(chunk);
  s = s.replace(/\begt\b/gi, "echt");
  let prev = "";
  while (prev !== s) {
    prev = s;
    s = s.replace(TRAILING_PROFILE_FILLER, "").trimEnd();
    s = s.replace(/\s{2,}/g, " ").trim();
  }
  s = reduceHaha(s);
  s = reduceEmoji(s, opts?.maxEmoji ?? (s.length < 80 ? 1 : 2));
  return s.trim();
}

export function logDutchHumanRealismDev(meta: {
  original: string;
  final: string;
  realismScore: number;
  rewriteApplied: boolean;
  issues: string[];
  applied?: string[];
  scoreBefore?: number;
}): void {
  if (process.env.NODE_ENV !== "development") return;
  console.info(
    "[dutch-human-realism]",
    JSON.stringify(
      {
        realism_score: meta.realismScore,
        score_before: meta.scoreBefore,
        rewrite_applied: meta.rewriteApplied,
        issues: meta.issues,
        applied: meta.applied,
        original: meta.original.slice(0, 500),
        final: meta.final.slice(0, 500),
      },
      null,
      2,
    ),
  );
}

/** Collect recent peer message bodies from thread history (newest first). */
export function lastPeerMessageBodies(
  history: Array<{ sender: string; kind?: string | null; body?: string | null }>,
  limit = 5,
): string[] {
  const out: string[] = [];
  for (let i = history.length - 1; i >= 0 && out.length < limit; i--) {
    const row = history[i];
    if (row.sender !== "peer" || row.kind === "image") continue;
    const b = (row.body ?? "").trim();
    if (b) out.push(b);
  }
  return out;
}
