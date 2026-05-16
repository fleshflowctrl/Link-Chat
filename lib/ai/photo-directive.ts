/**
 * Detect and extract a `[SEND_PHOTO: ...]` directive from a Grok reply.
 *
 * The system prompt teaches Grok that, when it would feel natural for the
 * persona to send a photo (user explicitly asked, or she's sharing a
 * concrete visual moment), she may emit ONE such directive at the end of
 * a chunk. The directive is parsed out before the chunk reaches the user.
 *
 * Format (case-insensitive, square brackets required):
 *   [SEND_PHOTO: scene description]
 *
 * Scene description constraints:
 *   - 6-280 characters
 *   - one short paragraph, comma-separated, no markdown, no quotes
 *   - describes what's IN the photo (objects, setting, mood) — not an
 *     instruction to a camera
 *
 * Multiple directives → only the first is honoured. Malformed directives
 * (no scene text, too long, or containing forbidden tokens) are still
 * stripped from the visible text but no photo is generated.
 */

const DIRECTIVE_RE = /\[\s*SEND[_\s]?PHOTO\s*:\s*([^\]]{1,400})\]/i;

const FORBIDDEN_SCENE_TOKENS = [
  // Child safety only — explicit adult content is allowed via negotiation flow.
  /child|minor|underage|pornography|pedophilia/i,
];

export type PhotoDirective = {
  /** Reply text with the directive removed (and surrounding whitespace
   * cleaned up). What gets shown to the user as the actual chat text. */
  cleanText: string;
  /** Scene description if a valid directive was present and accepted. */
  scene: string | null;
  /** When true, a directive was found but rejected (forbidden content,
   * too short, etc.). Caller may want to log this. */
  rejected: boolean;
};

export function extractPhotoDirective(text: string): PhotoDirective {
  if (!text) return { cleanText: "", scene: null, rejected: false };

  const match = text.match(DIRECTIVE_RE);
  if (!match) {
    return { cleanText: text, scene: null, rejected: false };
  }

  // Strip the directive and any redundant whitespace/punctuation around it.
  let cleanText = text.replace(DIRECTIVE_RE, "").trim();
  // Tidy double-spaces left behind.
  cleanText = cleanText.replace(/[ \t]{2,}/g, " ").trim();

  const scene = (match[1] ?? "").trim();

  // Reject empties / too-short / safety violations.
  if (scene.length < 6) {
    return { cleanText, scene: null, rejected: true };
  }
  if (FORBIDDEN_SCENE_TOKENS.some((re) => re.test(scene))) {
    return { cleanText, scene: null, rejected: true };
  }

  return { cleanText, scene, rejected: false };
}
