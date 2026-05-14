import { grokResponsesComplete } from "@/lib/xai/grok-responses";

/**
 * Optional second-pass refinement of a Grok reply.
 *
 * When `XAI_DRAFT_REVISE=1`, every assistant turn drafts → checks → optionally
 * rewrites once. The check prompt asks the model to be ruthless about AI
 * tells, length, and forced questions. Returns:
 *
 *   { ok: true, text, revised }
 *
 * If revision fails or the model refuses to rewrite, the original `draft`
 * passes through unchanged (`revised = false`).
 *
 * Cost: roughly doubles latency and Grok spend per turn. Reserve for
 * quality-critical flows or A/B comparisons. Default OFF.
 */
export function isDraftReviseEnabled(): boolean {
  const raw = process.env.XAI_DRAFT_REVISE?.trim().toLowerCase();
  if (!raw) return false;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export async function reviseDraftIfWorthIt(
  draft: string,
  systemPrompt: string,
): Promise<{ text: string; revised: boolean }> {
  if (!draft.trim()) return { text: draft, revised: false };

  const out = await grokResponsesComplete(
    [
      {
        role: "system",
        content: [
          "You are an editor for Dutch dating-app chat replies. Below is the persona's full system prompt followed by a candidate reply.",
          "",
          "Your job: judge whether the reply sounds like a real person on her phone — or like an AI.",
          "If it sounds clearly human, output the EXACT word: KEEP",
          "If it sounds like an AI, or is too long, too service-y, too symmetrical, or ends in a forced question: rewrite it ONCE in Dutch following all the persona rules. Output ONLY the rewritten reply, nothing else.",
          "",
          "Rules for the rewrite:",
          "- Same intent, same warmth, but more specific and shorter.",
          "- Drop trailing question if it feels forced.",
          "- No markdown, no quotes, no preamble.",
          "- Stay in character as the persona.",
          "",
          "PERSONA SYSTEM PROMPT:",
          systemPrompt,
        ].join("\n"),
      },
      {
        role: "user",
        content: `CANDIDATE REPLY:\n${draft}\n\nVerdict (KEEP or rewritten reply):`,
      },
    ],
    { temperature: 0.45, maxOutputTokens: 600 },
  );

  if (!out.ok) return { text: draft, revised: false };

  const verdict = out.text.trim();
  if (!verdict) return { text: draft, revised: false };

  if (/^keep\b/i.test(verdict)) return { text: draft, revised: false };

  // Strip any leading "REWRITE:" or quotes if the editor disobeys.
  const cleaned = verdict
    .replace(/^(rewrite|herschrijf|herziening)[:\s]*/i, "")
    .replace(/^["“”']+|["“”']+$/g, "")
    .trim();

  if (!cleaned || cleaned.length > draft.length * 2 + 200) {
    return { text: draft, revised: false };
  }
  return { text: cleaned, revised: true };
}
