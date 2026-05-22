/**
 * Typo / language cleanup — fix fake generated misspellings, no new random typos.
 * Runs after greeting-deduper, on each chunk before DB insert.
 */

/** Known broken tokens from models + old typo passes — restore natural Dutch. */
const FAKE_TYPO_FIXES: Array<[RegExp, string]> = [
  [/\bhoegaat\b/gi, "hoe gaat"],
  [/\bhoegaatje\b/gi, "hoe gaat je"],
  [/\bpirma\b/gi, "prima"],
  [/\bwatt\b/gi, "wat"],
  [/\begt\b/gi, "echt"],
  [/\btuurlijk\b/gi, "natuurlijk"],
  [/\bprima,net\b/gi, "prima, net"],
  [/\bgaat,prima\b/gi, "gaat prima"],
];

/** Strip accidental word-joins on common Dutch pairs. */
const JOIN_FIXES: Array<[RegExp, string]> = [
  [/\bhoegaat\b/gi, "hoe gaat"],
  [/\bgaatprima\b/gi, "gaat prima"],
  [/\bgaatgoed\b/gi, "gaat goed"],
  [/\bmetjou\b/gi, "met jou"],
  [/\bbijjou\b/gi, "bij jou"],
];

export function cleanupLanguageChunk(chunk: string): string {
  if (!chunk.trim()) return chunk;
  let s = chunk;

  for (const [re, repl] of [...FAKE_TYPO_FIXES, ...JOIN_FIXES]) {
    s = s.replace(re, repl);
  }

  return s.replace(/\s{2,}/g, " ").trim();
}

/** Typo injection disabled — only language cleanup (policy: no random word damage). */
export function applyLanguageCleanupPass(chunks: string[]): string[] {
  return chunks.map((c) => cleanupLanguageChunk(c));
}

export function logLanguageCleanupDev(meta: {
  before: string[];
  after: string[];
}): void {
  if (process.env.NODE_ENV !== "development") return;
  const changed = meta.before.some((b, i) => b !== meta.after[i]);
  if (!changed) return;
  console.info(
    "[language-cleanup]",
    JSON.stringify(
      {
        changed: true,
        before: meta.before.map((s) => s.slice(0, 200)),
        after: meta.after.map((s) => s.slice(0, 200)),
      },
      null,
      2,
    ),
  );
}
