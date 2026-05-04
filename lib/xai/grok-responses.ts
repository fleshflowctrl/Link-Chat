import { extractOutputText } from "@/lib/xai/parse-response-text";

const XAI_RESPONSES_URL = "https://api.x.ai/v1/responses";

export type GrokInputMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function grokResponsesComplete(
  input: GrokInputMessage[],
): Promise<{ ok: true; text: string; model: string } | { ok: false; error: string }> {
  const key = process.env.XAI_API_KEY?.trim();
  if (!key) {
    return { ok: false, error: "Missing XAI_API_KEY" };
  }
  const model = process.env.XAI_CHAT_MODEL?.trim() || "grok-4.3";

  const res = await fetch(XAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({ model, input }),
  });

  const raw = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      error: `Non-JSON from xAI (${res.status}): ${raw.slice(0, 200)}`,
    };
  }

  if (!res.ok) {
    const err = data as { error?: { message?: string }; message?: string };
    const msg =
      err.error?.message ??
      err.message ??
      JSON.stringify(data).slice(0, 400);
    return { ok: false, error: msg };
  }

  const text = extractOutputText(data);
  if (!text) {
    return {
      ok: false,
      error: `Empty reply from model (keys: ${Object.keys(data).join(", ")})`,
    };
  }

  return {
    ok: true,
    text,
    model: typeof data.model === "string" ? data.model : model,
  };
}
