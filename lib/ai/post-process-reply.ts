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

/** Multi-message separator emitted by Grok when prompt's allowMultiMessage
 * is on. We split on this BEFORE other postprocessing so each chunk is
 * cleaned independently. */
export const MULTI_MESSAGE_SEPARATOR = "<<<>>>";
const MULTI_SPLIT_RE = /\n*\s*<<<>>>\s*\n*/g;

/** Split a Grok reply into 1-N chat bubbles. The model is told to use
 * `<<<>>>` on its own line to separate bubbles. We tolerate surrounding
 * whitespace. Empty chunks are dropped. Output array preserves order.
 *
 * @param maxChunks Hard cap on how many bubbles to emit. Defaults to 4
 *   (the regular casual-multi mode). Pass 6 in burst mode so a "I'm
 *   excited and texting 5 short messages in a row" reply isn't folded.
 *   Anything beyond the cap is concatenated into the last bubble. */
export function splitMultiMessage(raw: string, maxChunks = 4): string[] {
  if (!raw) return [];
  const parts = raw
    .split(MULTI_SPLIT_RE)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length === 0) return [raw.trim()].filter((p) => p.length > 0);
  const cap = Math.max(1, Math.floor(maxChunks));
  // Safety: if Grok went wild and produced too many chunks, fold extras
  // into the last bubble so we don't spam the user.
  if (parts.length > cap) {
    const head = parts.slice(0, cap - 1);
    const tail = parts.slice(cap - 1).join(" ");
    return [...head, tail];
  }
  return parts;
}

const ABBREV_TABLE: Array<[RegExp, string]> = [
  [/\beven\b/g, "ff"],
  [/\bnatuurlijk\b/gi, "tuurlijk"],
  [/\becht\b/g, "egt"],
  [/\bweet niet\b/gi, "wn"],
  [/\biets\b/g, "ies"],
  [/\bgisteren\b/gi, "gister"],
  [/\bvandaag\b/g, "vandag"],
];

/** Apply a small humanisation pass: lowercase first letter sometimes, drop
 * trailing period sometimes, and at most ONE casual abbreviation. Inputs
 * the model already wrote casually (e.g. starts with lowercase, ends with
 * "?", contains a typo) are mostly left alone — the goal is to fix the
 * model's residual neatness, not to caricature.
 *
 * Each transformation is gated on a probability so personas don't all read
 * identical. Skip entirely for very short messages and for messages that
 * already feel chat-y (no terminal period, no leading capital). */
export function humanizeChatText(raw: string): string {
  if (!raw || raw.length < 8) return raw;
  let s = raw;

  // 1. Lowercase first character ~30% of the time, only if it's currently a
  // capital and not part of an obvious proper noun (we keep capitals when
  // followed by all-lowercase second letter and the leading "word" is >3
  // chars; shorter capitalised words are often names like "Ik", "Ja").
  if (Math.random() < 0.3) {
    const m = s.match(/^([A-ZÀ-Ý])([a-zà-ÿ])/);
    if (m && m[0].length === 2) {
      // Avoid lowercasing "Ik " / "Ja " / "Ja," / proper-name openers
      const firstWordEnd = s.search(/[\s,.!?]/);
      const firstWord = firstWordEnd > 0 ? s.slice(0, firstWordEnd) : s;
      if (firstWord.length >= 3 && firstWord !== firstWord.toUpperCase()) {
        s = s[0].toLowerCase() + s.slice(1);
      }
    }
  }

  // 2. Drop a single terminal period ~45% of the time. We never touch ?, !,
  // …, ..., or multi-period (.. or ...).
  if (Math.random() < 0.45) {
    s = s.replace(/(?<![.!?])\.(\s*)$/, "$1");
  }

  // 3. At most one abbreviation per message, ~20% chance. Pick a random
  // entry from the table that *matches* this message; if none match, skip.
  if (Math.random() < 0.2) {
    const eligible = ABBREV_TABLE.filter(([re]) => re.test(s));
    if (eligible.length > 0) {
      const [re, repl] = eligible[Math.floor(Math.random() * eligible.length)];
      // Reset lastIndex on global regex before single replace
      re.lastIndex = 0;
      const match = re.exec(s);
      if (match) {
        s = s.slice(0, match.index) + repl + s.slice(match.index + match[0].length);
      }
    }
  }

  return s;
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

  // Final humanisation pass — catches Grok's residual tidy formatting.
  s = humanizeChatText(s.trim());

  return s.trim();
}
