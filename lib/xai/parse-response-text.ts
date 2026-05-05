/** Parse xAI `/v1/responses` JSON body for user-visible assistant text. */
export function extractOutputText(data: Record<string, unknown>): string | null {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }
  if (typeof data.text === "string" && data.text.trim()) {
    return data.text.trim();
  }

  /** Legacy `/v1/chat/completions` shape */
  const choices = data.choices;
  if (Array.isArray(choices) && choices[0] && typeof choices[0] === "object") {
    const msg = (choices[0] as Record<string, unknown>).message;
    if (msg && typeof msg === "object") {
      const c = (msg as Record<string, unknown>).content;
      if (typeof c === "string" && c.trim()) return c.trim();
    }
  }

  const output = data.output;
  if (!Array.isArray(output)) return null;

  const outputTexts: string[] = [];
  const fallbackTexts: string[] = [];

  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const block = item as Record<string, unknown>;

    if (typeof block.text === "string" && block.text.trim()) {
      fallbackTexts.push(block.text.trim());
    }

    const content = block.content;
    if (typeof content === "string" && content.trim()) {
      fallbackTexts.push(content.trim());
    } else if (Array.isArray(content)) {
      for (const part of content) {
        if (!part || typeof part !== "object") continue;
        const p = part as Record<string, unknown>;
        const t = p.text;
        if (typeof t !== "string" || !t.trim()) continue;
        const trimmed = t.trim();
        if (p.type === "output_text") outputTexts.push(trimmed);
        else fallbackTexts.push(trimmed);
      }
    }

    const summary = block.summary;
    if (Array.isArray(summary)) {
      for (const s of summary) {
        if (!s || typeof s !== "object") continue;
        const t = (s as Record<string, unknown>).text;
        if (typeof t === "string" && t.trim()) fallbackTexts.push(t.trim());
      }
    }
  }

  if (outputTexts.length) return outputTexts.join("\n").trim();
  if (fallbackTexts.length) return fallbackTexts.join("\n").trim();
  return null;
}
