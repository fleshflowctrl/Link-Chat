/**
 * Emoji realism guard — throttle emoji so bot messages don't feel AI-default.
 * Runs after language cleanup, before DB / frontend delivery.
 */

import type { CombinedUserIntent } from "@/lib/ai/message-intent-normalizer";

const EMOJI_RE = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]/g;

/** Remove first — feel AI / service / default flirty closer. */
const STRIP_FIRST = new Set(["😊", "🙂", "😉", "😅", "☺️", "😀"]);

/** Allowed sparingly when tone warrants. */
const ALLOW_SPARING = new Set(["😭", "🙄", "😏", "😂", "🤭", "💀"]);

const BASIC_NO_EMOJI_CHUNK_RES = [
  /^\s*gaat\s+prima\b/i,
  /^\s*gaat\s+(?:goed|wel)\b/i,
  /^\s*wat\s+ben\s+jij\b/i,
  /^\s*haha\s+slim\b/i,
  /^\s*(?:hoi|hey|heyy)\b/i,
  /^\s*hoe\s+gaat\b/i,
  /^\s*ook\s+prima\b/i,
  /^\s*klinkt\s+(?:chill|goed|lekker)\b/i,
];

function extractEmojis(text: string): string[] {
  const out: string[] = [];
  const re = new RegExp(EMOJI_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    out.push(m[0]);
  }
  return out;
}

function countEmojis(text: string): number {
  return extractEmojis(text).length;
}

function userUsesEmoji(userMessage: string): boolean {
  return countEmojis(userMessage) > 0;
}

function recentEmojiRate(recentBotMessages: string[], window = 5): number {
  const slice = recentBotMessages.slice(0, window);
  if (!slice.length) return 0;
  const withEmoji = slice.filter((m) => countEmojis(m) > 0).length;
  return withEmoji / slice.length;
}

function chunkIsBasicSmalltalk(chunk: string): boolean {
  const t = chunk.trim();
  if (t.length > 90) return false;
  return BASIC_NO_EMOJI_CHUNK_RES.some((re) => re.test(t));
}

function hasPlayfulOrFlirtyTone(
  text: string,
  intent?: CombinedUserIntent,
  userFlirtLevel?: string,
): boolean {
  if (
    intent === "flirt" ||
    intent === "compliment" ||
    intent === "greeting_plus_how_are_you"
  ) {
    return /\b(?:smooth|slim|makkelijk|grapje|punten|flirt|app|plan)\b/i.test(text);
  }
  if (userFlirtLevel === "high" || userFlirtLevel === "explicit") {
    return /\b(?:smooth|slim|makkelijk|werkt|app|jij)\b/i.test(text);
  }
  return /\b(?:smooth|slim antwoord|makkelijk|grapje|ai-test|meteen aangevallen|wow)\b/i.test(
    text,
  );
}

function allowsEmojiInResponse(
  allText: string,
  chunks: string[],
  input: EmojiRealismGuardInput,
): boolean {
  const userEmoji = userUsesEmoji(input.currentUserMessage);
  const rate = recentEmojiRate(input.recentBotMessages, 5);

  if (chunks.every((c) => chunkIsBasicSmalltalk(c))) return false;
  if (rate >= 0.4) return false;
  if (!userEmoji && rate >= 0.2 && !hasPlayfulOrFlirtyTone(allText, input.combinedUserIntent, input.userFlirtLevel)) {
    return false;
  }
  if (!hasPlayfulOrFlirtyTone(allText, input.combinedUserIntent, input.userFlirtLevel)) {
    if (!userEmoji) return false;
    if (rate >= 0.2) return false;
  }
  return true;
}

function stripAllEmojis(text: string): { text: string; removed: string[] } {
  const removed = extractEmojis(text);
  return {
    text: text.replace(EMOJI_RE, "").replace(/\s{2,}/g, " ").trim(),
    removed,
  };
}

function stripPriorityEmojis(text: string): { text: string; removed: string[] } {
  const removed: string[] = [];
  let s = text;
  for (const em of Array.from(STRIP_FIRST)) {
    if (s.includes(em)) {
      removed.push(em);
      s = s.split(em).join("");
    }
  }
  return { text: s.replace(/\s{2,}/g, " ").trim(), removed };
}

function pickBestChunkForEmoji(chunks: string[]): number {
  let best = 0;
  let bestScore = -1;
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i]!;
    let score = 0;
    if (/\bhaha\b/i.test(c)) score += 2;
    if (/\b(?:smooth|slim|makkelijk|grapje|werkt)\b/i.test(c)) score += 3;
    if (/\b(?:ai|bot|test)\b/i.test(c)) score += 1;
    if (chunkIsBasicSmalltalk(c)) score -= 5;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

export type EmojiRealismGuardInput = {
  /** Final chunk texts (post language-cleanup). */
  chunks: string[];
  recentBotMessages: string[];
  currentUserMessage: string;
  combinedUserIntent?: CombinedUserIntent;
  userFlirtLevel?: "low" | "medium" | "high" | "explicit";
  bondFormed?: boolean;
  personaEmojiPalette?: string[];
};

export type EmojiRealismGuardResult = {
  chunks: string[];
  emojiCount: number;
  recentEmojiRate: number;
  emojiRemoved: boolean;
  removedEmojis: string[];
  finalResponse: string;
};

export function applyEmojiRealismGuard(
  input: EmojiRealismGuardInput,
): EmojiRealismGuardResult {
  const originalJoined = input.chunks.join(" | ");
  const allRemoved: string[] = [];
  let chunks = input.chunks.map((c) => c.trim()).filter(Boolean);

  const initialCount = chunks.reduce((n, c) => n + countEmojis(c), 0);
  const rate = recentEmojiRate(input.recentBotMessages, 5);

  if (initialCount === 0) {
    return {
      chunks,
      emojiCount: 0,
      recentEmojiRate: rate,
      emojiRemoved: false,
      removedEmojis: [],
      finalResponse: chunks.join("\n"),
    };
  }

  const allText = chunks.join(" ");
  const mayKeepAny = allowsEmojiInResponse(allText, chunks, input);

  if (!mayKeepAny) {
    chunks = chunks.map((c) => {
      const { text, removed } = stripAllEmojis(c);
      allRemoved.push(...removed);
      return text;
    }).filter((c) => c.length > 0);
  } else {
    chunks = chunks.map((c) => {
      const { text, removed } = stripPriorityEmojis(c);
      allRemoved.push(...removed);
      return text;
    });

    let total = chunks.reduce((n, c) => n + countEmojis(c), 0);
    const maxEmoji = 1;

    while (total > maxEmoji) {
      let stripped = false;
      for (let i = chunks.length - 1; i >= 0 && total > maxEmoji; i--) {
        const emojis = extractEmojis(chunks[i]!);
        if (emojis.length === 0) continue;
        const toRemove = emojis[emojis.length - 1]!;
        allRemoved.push(toRemove);
        chunks[i] = chunks[i]!.replace(toRemove, "").replace(/\s{2,}/g, " ").trim();
        total -= 1;
        stripped = true;
      }
      if (!stripped) break;
    }

    total = chunks.reduce((n, c) => n + countEmojis(c), 0);
    if (total === 1) {
      const idx = pickBestChunkForEmoji(chunks);
      for (let i = 0; i < chunks.length; i++) {
        if (i === idx) continue;
        const { text, removed } = stripAllEmojis(chunks[i]!);
        allRemoved.push(...removed);
        chunks[i] = text;
      }
      const lone = extractEmojis(chunks[idx] ?? "")[0];
      if (
        lone &&
        STRIP_FIRST.has(lone) &&
        !hasPlayfulOrFlirtyTone(chunks[idx] ?? "", input.combinedUserIntent, input.userFlirtLevel)
      ) {
        allRemoved.push(lone);
        chunks[idx] = (chunks[idx] ?? "").replace(lone, "").trim();
      }
      if (
        lone &&
        !ALLOW_SPARING.has(lone) &&
        !STRIP_FIRST.has(lone) &&
        !hasPlayfulOrFlirtyTone(chunks[idx] ?? "", input.combinedUserIntent, input.userFlirtLevel)
      ) {
        allRemoved.push(lone);
        chunks[idx] = (chunks[idx] ?? "").replace(lone, "").trim();
      }
    }
  }

  chunks = chunks.filter((c) => c.length > 0);
  const finalCount = chunks.reduce((n, c) => n + countEmojis(c), 0);
  const finalResponse = chunks.join("\n");
  const emojiRemoved =
    finalCount < initialCount || originalJoined !== finalResponse;

  const result: EmojiRealismGuardResult = {
    chunks,
    emojiCount: finalCount,
    recentEmojiRate: rate,
    emojiRemoved,
    removedEmojis: Array.from(new Set(allRemoved)),
    finalResponse,
  };

  logEmojiRealismGuardDev({
    ...result,
    originalResponse: originalJoined,
  });

  return result;
}

export function logEmojiRealismGuardDev(meta: {
  emojiCount: number;
  recentEmojiRate: number;
  emojiRemoved: boolean;
  removedEmojis: string[];
  originalResponse: string;
  finalResponse: string;
}): void {
  if (process.env.NODE_ENV !== "development") return;
  console.info(
    "[emoji-realism-guard]",
    JSON.stringify(
      {
        emoji_count: meta.emojiCount,
        recent_emoji_rate: meta.recentEmojiRate,
        emoji_removed: meta.emojiRemoved,
        removed_emojis: meta.removedEmojis,
        original: meta.originalResponse.slice(0, 500),
        final: meta.finalResponse.slice(0, 500),
      },
      null,
      2,
    ),
  );
}
