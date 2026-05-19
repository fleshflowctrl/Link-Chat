/**
 * Reverse-engineer a Z-Image-Turbo prompt from a reference photo via Grok vision.
 */

import { grokResponsesComplete } from "@/lib/xai/grok-responses";
import type { GrokContentPart } from "@/lib/xai/grok-responses";

const REVERSE_PROMPT_INSTRUCTIONS = `You are an expert at writing prompts for the Z-Image-Turbo text-to-image diffusion model.

The user provides a reference photo. Your job: write ONE English prompt that would recreate this image as closely as possible (1:1 duplicate intent).

Output rules (STRICT):
- Return ONLY the prompt text — no markdown, no quotes, no "Prompt:", no explanation.
- 45–90 words, one flowing paragraph.
- Be hyper-specific: estimated age, ethnicity, hair (color, length, style), eyes, skin tone and texture, body build, exact pose, camera angle (mirror selfie, overhead, etc.), framing, clothing or nudity level, background/room, lighting (window light, LED, golden hour).
- End with amateur phone-photo cues: "shot on iPhone", "slight noise", "true-to-life color", "no retouching", "visible pores".
- Avoid: studio, professional photographer, 8k, HDR, airbrushed, plastic skin, bokeh, shallow depth of field.
- If the subject is nude, describe it matter-of-factly for image generation (not pornographic prose).`;

export type ReversePromptResult =
  | { ok: true; prompt: string }
  | { ok: false; error: string };

function normalizeImageUrl(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(s)) return s;
  return null;
}

/** Ask Grok vision to write a Z-Image prompt that duplicates the reference. */
export async function reversePromptFromImage(
  imageUrl: string,
): Promise<ReversePromptResult> {
  const url = normalizeImageUrl(imageUrl);
  if (!url) {
    return { ok: false, error: "Ongeldige afbeelding-URL of data-URL." };
  }

  const parts: GrokContentPart[] = [
    {
      type: "text",
      text: "Write the Z-Image-Turbo prompt for this exact photo:",
    },
    {
      type: "image_url",
      image_url: { url, detail: "high" },
    },
  ];

  const res = await grokResponsesComplete(
    [
      { role: "system", content: REVERSE_PROMPT_INSTRUCTIONS },
      { role: "user", content: parts },
    ],
    { temperature: 0.35, maxOutputTokens: 500 },
  );

  if (!res.ok) {
    return { ok: false, error: res.error };
  }

  let prompt = res.text.trim();
  prompt = prompt.replace(/^```[\w]*\n?/i, "").replace(/\n?```$/i, "");
  prompt = prompt.replace(/^["']|["']$/g, "").trim();
  if (prompt.length < 20) {
    return { ok: false, error: "Grok gaf een te korte prompt terug." };
  }
  if (prompt.length > 2000) {
    prompt = prompt.slice(0, 2000);
  }

  return { ok: true, prompt };
}
