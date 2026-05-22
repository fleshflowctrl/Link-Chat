/**
 * Typo & imperfection pass.
 *
 * Real chat is messy — autocorrect fails, missed spaces, swapped letters,
 * lowercase i's. The model writes too cleanly by default. This module
 * runs AFTER chunking and voice fingerprint, and selectively damages
 * roughly 0.5% to 2% of words per message (so most messages have 0–1 typo).
 *
 * It is deterministic per (ownerUserId × peerProfileId × messageIndex)
 * so re-renders don't shuffle the typos around.
 */

type Rng = () => number;

function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  if (s === 0) s = 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function toSeed(strings: string[]): number {
  let h = 2166136261;
  for (const s of strings) {
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
  }
  return h >>> 0;
}

/** Common Dutch chat-style misspellings — high frequency. */
const COMMON_TYPO_MAP: Record<string, string[]> = {
  even: ["efkes", "evn"],
  weet: ["weeet", "wet"],
  hebben: ["hbben", "heb"],
  haha: ["hahha", "haahh", "hah"],
  beetje: ["beejte", "btje"],
  misschien: ["mss", "msschien"],
  natuurlijk: ["tuurlijk", "tuuk", "natuurlijkk"],
  trouwens: ["trouwes", "trws"],
  alleen: ["alln", "alleeen"],
  gewoon: ["gwn", "gewon"],
  vandaag: ["vndaag", "vandag"],
  morgen: ["mrgn", "morgenn"],
  vanavond: ["vanavnd", "vnavond"],
  precies: ["preciess", "precis"],
  helemaal: ["helemll", "hlmaal"],
  iemand: ["iemnd", "iemmnd"],
  niemand: ["niemnd"],
  beste: ["bestee", "best"],
  iets: ["iets", "iet"],
  ofzo: ["of zo"],
};

/** Letter-swap typos — pick a random word, swap two adjacent letters in middle. */
function swapAdjacent(word: string, rng: Rng): string {
  if (word.length < 4) return word;
  const i = 1 + Math.floor(rng() * (word.length - 3));
  return word.slice(0, i) + word[i + 1]! + word[i]! + word.slice(i + 2);
}

/** Drop a doubled letter occasionally. */
function dropDouble(word: string): string {
  return word.replace(/(.)\1/, "$1");
}

/** Add a doubled letter occasionally. */
function addDouble(word: string, rng: Rng): string {
  if (word.length < 3) return word;
  const i = 1 + Math.floor(rng() * (word.length - 1));
  return word.slice(0, i) + word[i] + word.slice(i);
}

/** Drop a vowel near the end (gw, mss style). */
function dropVowel(word: string): string {
  // Only for short, common words; otherwise we read like garbage.
  if (word.length < 4 || word.length > 7) return word;
  const idx = word.search(/[aeiou]/i);
  if (idx <= 0) return word;
  return word.slice(0, idx) + word.slice(idx + 1);
}

/** Forget a space between two words. */
function joinAdjacent(words: string[], i: number): string[] {
  if (i + 1 >= words.length) return words;
  const next = words.slice();
  next[i] = words[i]! + words[i + 1]!;
  next.splice(i + 1, 1);
  return next;
}

/** Lowercase a stray "I" or capitalised middle word. */
function lowerOne(word: string): string {
  if (word.length === 0) return word;
  if (/^[A-Z]/.test(word) && !/^[A-Z][A-Z]/.test(word)) {
    return word[0]!.toLowerCase() + word.slice(1);
  }
  return word;
}

function corruptWord(word: string, rng: Rng): string {
  // Strip leading/trailing punctuation — restore at end.
  const m = word.match(/^([^\w]*)(.+?)([^\w]*)$/);
  if (!m) return word;
  const [, lead, core, trail] = m;
  if (!core || core.length < 3) return word;

  const lc = core.toLowerCase();
  const known = COMMON_TYPO_MAP[lc];
  let damaged: string;

  if (known && rng() < 0.6) {
    const variant = known[Math.floor(rng() * known.length)]!;
    damaged = /^[A-Z]/.test(core) ? variant[0]!.toUpperCase() + variant.slice(1) : variant;
  } else {
    const r = rng();
    if (r < 0.3) damaged = swapAdjacent(core, rng);
    else if (r < 0.5) damaged = dropDouble(core);
    else if (r < 0.65) damaged = addDouble(core, rng);
    else if (r < 0.8) damaged = dropVowel(core);
    else damaged = lowerOne(core);
  }

  return `${lead ?? ""}${damaged}${trail ?? ""}`;
}

/** Decide how many words in a chunk to corrupt — usually 0 or 1, rarely 2. */
function pickCorruptionCount(wordCount: number, rng: Rng): number {
  if (wordCount < 3) return 0;
  const r = rng();
  if (wordCount < 8) {
    if (r < 0.7) return 0;
    if (r < 0.95) return 1;
    return 2;
  }
  // Longer chunks get up to 2 typos.
  if (r < 0.55) return 0;
  if (r < 0.9) return 1;
  return 2;
}

/** Random word corruption disabled — use `applyLanguageCleanupPass` instead. */
export function applyTypoPass(
  chunks: string[],
  _ctx: { ownerUserId: string; peerProfileId: string; messageIndex: number },
): string[] {
  return chunks;
}

/** @deprecated Use applyLanguageCleanupPass. Kept for imports. */
export function applyTypoPassLegacy(
  chunks: string[],
  ctx: { ownerUserId: string; peerProfileId: string; messageIndex: number },
): string[] {
  const seed = toSeed([
    ctx.ownerUserId,
    ctx.peerProfileId,
    String(ctx.messageIndex),
    "typo",
  ]);
  const rng = makeRng(seed);

  return chunks.map((chunk, ci) => {
    if (chunk.trim().length === 0) return chunk;
    if (/^\[SEND_PHOTO/i.test(chunk.trim())) return chunk; // never corrupt directives

    const chunkRng = makeRng(seed + ci * 7919);

    const tokens = chunk.split(/(\s+)/); // keep whitespace tokens alternating
    const wordIndices: number[] = [];
    for (let i = 0; i < tokens.length; i++) {
      if (/^\S/.test(tokens[i]!) && /[a-zA-Z]/.test(tokens[i]!)) wordIndices.push(i);
    }
    const wordCount = wordIndices.length;
    const targetCount = pickCorruptionCount(wordCount, chunkRng);
    if (targetCount === 0) return chunk;

    // Pick distinct word indices to corrupt.
    const pickedArr: number[] = [];
    const pickedSet = new Set<number>();
    let attempts = 0;
    while (pickedArr.length < targetCount && attempts < targetCount * 4) {
      const idx = wordIndices[Math.floor(chunkRng() * wordIndices.length)]!;
      if (!pickedSet.has(idx)) {
        pickedSet.add(idx);
        pickedArr.push(idx);
      }
      attempts++;
    }
    for (const idx of pickedArr) {
      tokens[idx] = corruptWord(tokens[idx]!, chunkRng);
    }

    let result = tokens.join("");

    // Occasionally also forget a space between two short words.
    if (chunkRng() < 0.08) {
      const words = result.split(/\s+/);
      if (words.length > 3) {
        const i = 1 + Math.floor(chunkRng() * (words.length - 2));
        if ((words[i]?.length ?? 0) <= 4 && (words[i + 1]?.length ?? 0) <= 5) {
          const merged = joinAdjacent(words, i);
          result = merged.join(" ");
        }
      }
    }

    return result;
  });
}

/** Signature typo injection disabled — appended filler ("egt", "joh") read artificial. */
export function applySignatureTypo(
  chunks: string[],
  _signatureTypo: string | null | undefined,
  _ctx: { ownerUserId: string; peerProfileId: string; messageIndex: number },
): string[] {
  return chunks;
}
