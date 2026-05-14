/**
 * Post-process a raw Grok reply before it lands in the chat as a peer message.
 *
 * Goal: scrub the rare LLM artifacts that leak through (markdown, code fences,
 * service-y leading phrases, em-dashes used as grammatical hyphens, runaway
 * length) without altering the persona's intentional tone.
 *
 * Invariant: this function is a *defensive* layer. The system prompt already
 * forbids most of these things — postprocessing only catches outliers.
 */

const MAX_REPLY_CHARS = 700;

/** Service-y / AI-toned openers that real chatters never use. Case-insensitive. */
const LEADING_PHRASES_RE =
  /^(sure|of course|absolutely|certainly|haha sure|ohh sure|natuurlijk|tuurlijk|zeker(weten)?|geen probleem|ja(zeker)?|prima|okidoki|hier (is|komt) je|here'?s your)[,.!:]?\s+/i;

/** Pure-meta wrappers some models add when they think they're "answering". */
const META_WRAPPER_RES: RegExp[] = [
  /^reply:\s*/i,
  /^response:\s*/i,
  /^assistant:\s*/i,
  /^answer:\s*/i,
  /^(jouw|haar) antwoord:\s*/i,
];

/** Detect at least one emoji (rough — covers most common modern emoji ranges).
 * Implementation note: tsconfig lacks an `es2018+` target, so we cannot use the
 * `u` flag with `\p{Extended_Pictographic}`. We instead detect any astral-plane
 * codepoint via surrogate pair (emoji from U+1F300+) plus the BMP dingbats /
 * misc-symbols block. Catches ~all in-the-wild chat emoji. */
const EMOJI_RE = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]/;

export function hasEmoji(s: string): boolean {
  return EMOJI_RE.test(s);
}

export function endsWithQuestion(s: string): boolean {
  return /[?\uFF1F]\s*$/.test(s.trim());
}

export function postProcessReply(raw: string): string {
  if (!raw) return "";
  let s = raw.replace(/\r\n/g, "\n").trim();

  // Strip code fences (entire block) — chat replies should never contain code.
  s = s.replace(/```[\s\S]*?```/g, "").trim();

  // Strip surrounding quotes a model may wrap a reply in.
  s = s.replace(/^["\u201C\u201D'`]+/, "").replace(/["\u201C\u201D'`]+$/, "").trim();

  // Strip meta wrappers ("Reply: …").
  for (const re of META_WRAPPER_RES) {
    s = s.replace(re, "").trim();
  }

  // Strip service-y leading phrases.
  s = s.replace(LEADING_PHRASES_RE, "").trim();

  // Strip markdown bold/italic markers (keep inner text).
  s = s.replace(/\*\*(.+?)\*\*/g, "$1");
  s = s.replace(/(?<!\*)\*([^\s*][^*]*?[^\s*]|\S)\*/g, "$1");

  // Strip leading bullet markers on lines (real chatters don't bullet).
  s = s.replace(/^\s*[-*\u2022]\s+/gm, "");

  // Strip leading markdown headings.
  s = s.replace(/^#+\s+/gm, "");

  // Replace em-dashes used as grammatical hyphens with spaced en-dash —
  // this is the single biggest AI tell in casual chat. We keep an en-dash
  // (with spaces) so meaning stays intact, but the look becomes much more human.
  s = s.replace(/\s*\u2014\s*/g, " \u2013 ");

  // Collapse 3+ blank lines to 2.
  s = s.replace(/\n{3,}/g, "\n\n");

  // Trim runaway length (the model occasionally ignores the ~120-word rule).
  if (s.length > MAX_REPLY_CHARS) {
    const cut = s.slice(0, MAX_REPLY_CHARS);
    const lastSpace = cut.lastIndexOf(" ");
    s = (lastSpace > 200 ? cut.slice(0, lastSpace) : cut).replace(/[,.;:!?\s]+$/, "") + "\u2026";
  }

  return s.trim();
}
