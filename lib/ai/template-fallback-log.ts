/**
 * Dev logging when deterministic template fallbacks replace model output.
 */

export type TemplateFallbackLogInput = {
  fallbackUsed: boolean;
  fallbackReason: string;
  selectedTemplate: string;
  peerId: string;
  personaName: string;
  intent: string;
  rawGrokResponse: string;
  finalResponse: string;
};

export function logTemplateFallback(meta: TemplateFallbackLogInput): void {
  if (process.env.NODE_ENV !== "development") return;
  if (!meta.fallbackUsed) return;
  console.info(
    "[template-fallback]",
    JSON.stringify(
      {
        fallback_used: meta.fallbackUsed,
        fallback_reason: meta.fallbackReason,
        selected_template: meta.selectedTemplate,
        peer_id: meta.peerId,
        persona_name: meta.personaName,
        intent: meta.intent,
        raw_grok_response: meta.rawGrokResponse.slice(0, 400),
        final_response: meta.finalResponse.slice(0, 400),
      },
      null,
      2,
    ),
  );
}
