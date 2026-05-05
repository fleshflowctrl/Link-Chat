import { extractOutputText } from "@/lib/xai/parse-response-text";

const XAI_RESPONSES_URL = "https://api.x.ai/v1/responses";
const XAI_CHAT_COMPLETIONS_URL = "https://api.x.ai/v1/chat/completions";

/** Reasoning models can exceed default serverless timeouts; keep client fetch bounded. */
const XAI_FETCH_TIMEOUT_MS = Math.min(
  Math.max(Number(process.env.XAI_FETCH_TIMEOUT_MS) || 120_000, 15_000),
  300_000,
);

export type GrokInputMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function xaiFetchSignal(): AbortSignal {
  return AbortSignal.timeout(XAI_FETCH_TIMEOUT_MS);
}

/** Prefer `instructions` for system text; dialogue uses user/assistant only (xAI Responses API). */
function buildResponsesPayload(model: string, input: GrokInputMessage[]) {
  const systemChunks = input
    .filter((m) => m.role === "system")
    .map((m) => m.content.trim())
    .filter(Boolean);
  const dialogue = input.filter((m) => m.role !== "system");
  const payload: Record<string, unknown> = {
    model,
    max_output_tokens: 1024,
    input: dialogue.length > 0 ? dialogue : input,
  };
  if (systemChunks.length > 0) {
    payload.instructions = systemChunks.join("\n\n");
  }
  return payload;
}

async function grokViaResponses(
  key: string,
  model: string,
  input: GrokInputMessage[],
): Promise<
  | { ok: true; text: string; model: string }
  | { ok: false; error: string; httpStatus?: number }
> {
  const res = await fetch(XAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(buildResponsesPayload(model, input)),
    signal: xaiFetchSignal(),
  });

  const raw = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      error: `Non-JSON from xAI (${res.status}): ${raw.slice(0, 200)}`,
      httpStatus: res.status,
    };
  }

  if (!res.ok) {
    const err = data as { error?: { message?: string }; message?: string };
    const msg =
      err.error?.message ??
      err.message ??
      JSON.stringify(data).slice(0, 400);
    return { ok: false, error: msg, httpStatus: res.status };
  }

  const text = extractOutputText(data);
  if (!text) {
    return {
      ok: false,
      error: `Empty reply from Responses API (keys: ${Object.keys(data).join(", ")})`,
      httpStatus: res.status,
    };
  }

  return {
    ok: true,
    text,
    model: typeof data.model === "string" ? data.model : model,
  };
}

async function grokViaChatCompletions(
  key: string,
  model: string,
  input: GrokInputMessage[],
): Promise<
  | { ok: true; text: string; model: string }
  | { ok: false; error: string; httpStatus?: number }
> {
  const res = await fetch(XAI_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: input,
      temperature: 0.7,
    }),
    signal: xaiFetchSignal(),
  });

  const raw = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      error: `Non-JSON from chat/completions (${res.status}): ${raw.slice(0, 200)}`,
      httpStatus: res.status,
    };
  }

  if (!res.ok) {
    const err = data as { error?: { message?: string }; message?: string };
    const msg =
      err.error?.message ??
      err.message ??
      JSON.stringify(data).slice(0, 400);
    return { ok: false, error: msg, httpStatus: res.status };
  }

  const text = extractOutputText(data);
  if (!text) {
    return {
      ok: false,
      error: `Empty reply from chat/completions (keys: ${Object.keys(data).join(", ")})`,
      httpStatus: res.status,
    };
  }

  return {
    ok: true,
    text,
    model: typeof data.model === "string" ? data.model : model,
  };
}

/**
 * Complete a chat turn via xAI. Tries Responses API first, then `/v1/chat/completions`
 * if the first call errors or returns no visible text (common when keys only allow one path).
 */
export async function grokResponsesComplete(
  input: GrokInputMessage[],
): Promise<{ ok: true; text: string; model: string } | { ok: false; error: string }> {
  const key = process.env.XAI_API_KEY?.trim();
  if (!key) {
    return { ok: false, error: "Missing XAI_API_KEY" };
  }
  const model = process.env.XAI_CHAT_MODEL?.trim() || "grok-4.3";

  const first = await grokViaResponses(key, model, input);
  if (first.ok) return first;

  const second = await grokViaChatCompletions(key, model, input);
  if (second.ok) return second;

  return {
    ok: false,
    error: `${first.error} | Fallback: ${second.error}`,
  };
}
