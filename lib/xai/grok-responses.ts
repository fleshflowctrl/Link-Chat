import { extractOutputText } from "@/lib/xai/parse-response-text";

const XAI_RESPONSES_URL = "https://api.x.ai/v1/responses";
const XAI_CHAT_COMPLETIONS_URL = "https://api.x.ai/v1/chat/completions";

/** Reasoning models can exceed default serverless timeouts; keep client fetch bounded. */
const XAI_FETCH_TIMEOUT_MS = Math.min(
  Math.max(Number(process.env.XAI_FETCH_TIMEOUT_MS) || 120_000, 15_000),
  300_000,
);

/** Text part of a multimodal message. */
export type GrokTextPart = { type: "text"; text: string };

/** Image part of a multimodal user message. xAI vision models follow the
 * OpenAI shape: { type: "image_url", image_url: { url: string, detail?: ... } }. */
export type GrokImagePart = {
  type: "image_url";
  image_url: { url: string; detail?: "low" | "high" | "auto" };
};

export type GrokContentPart = GrokTextPart | GrokImagePart;

export type GrokInputMessage = {
  role: "system" | "user" | "assistant";
  /** Plain string for ordinary turns; array of content parts when the
   * message includes a photo (only `user` role uses image parts). */
  content: string | GrokContentPart[];
};

function contentToPlainText(content: string | GrokContentPart[]): string {
  if (typeof content === "string") return content;
  return content
    .map((p) => (p.type === "text" ? p.text : "[photo]"))
    .join(" ")
    .trim();
}

function logGrokUsage(
  label: string,
  model: string,
  data: Record<string, unknown>,
): void {
  const raw = process.env.XAI_LOG_USAGE?.trim().toLowerCase();
  if (!raw || raw === "0" || raw === "false" || raw === "off") return;

  const usage =
    (data.usage as Record<string, unknown> | undefined) ??
    ((data.response as Record<string, unknown> | undefined)?.usage as
      | Record<string, unknown>
      | undefined);

  if (!usage) return;

  console.info("[xai-usage]", {
    label,
    model,
    input_tokens: usage.input_tokens ?? usage.prompt_tokens,
    output_tokens: usage.output_tokens ?? usage.completion_tokens,
    cached_input_tokens: usage.cached_input_tokens ?? usage.cache_read_input_tokens,
    total_tokens: usage.total_tokens,
  });
}

function xaiFetchSignal(): AbortSignal {
  return AbortSignal.timeout(XAI_FETCH_TIMEOUT_MS);
}

function fetchErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

function isTransientGrokError(error: string): boolean {
  return /fetch failed|econnreset|etimedout|network|timeout|aborted|socket hang up|und_err_connect/i.test(
    error,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type GrokCompleteOptions = {
  /** Chat completions + some Responses models; default 0.62 */
  temperature?: number;
  maxOutputTokens?: number;
};

/** xAI Responses API uses `input_image` / `input_text`, not OpenAI chat-completions parts. */
function toResponsesDialogueMessage(m: GrokInputMessage): {
  role: string;
  content: string | Array<Record<string, unknown>>;
} {
  if (typeof m.content === "string") {
    return { role: m.role, content: m.content };
  }
  return {
    role: m.role,
    content: m.content.map((p) => {
      if (p.type === "text") {
        return { type: "input_text", text: p.text };
      }
      return {
        type: "input_image",
        image_url: p.image_url.url,
        detail: p.image_url.detail ?? "high",
      };
    }),
  };
}

/** Prefer `instructions` for system text; dialogue uses user/assistant only (xAI Responses API). */
function buildResponsesPayload(
  model: string,
  input: GrokInputMessage[],
  opts: GrokCompleteOptions,
) {
  const systemChunks = input
    .filter((m) => m.role === "system")
    .map((m) => contentToPlainText(m.content).trim())
    .filter(Boolean);
  const dialogue = input
    .filter((m) => m.role !== "system")
    .map(toResponsesDialogueMessage);
  const maxOut = Math.min(
    Math.max(opts.maxOutputTokens ?? 1024, 64),
    8192,
  );
  const payload: Record<string, unknown> = {
    model,
    max_output_tokens: maxOut,
    input: dialogue.length > 0 ? dialogue : input.map(toResponsesDialogueMessage),
  };
  if (systemChunks.length > 0) {
    payload.instructions = systemChunks.join("\n\n");
  }
  if (typeof opts.temperature === "number") {
    payload.temperature = Math.min(2, Math.max(0, opts.temperature));
  }
  return payload;
}

async function grokViaResponses(
  key: string,
  model: string,
  input: GrokInputMessage[],
  opts: GrokCompleteOptions,
): Promise<
  | { ok: true; text: string; model: string }
  | { ok: false; error: string; httpStatus?: number }
> {
  let res: Response;
  try {
    res = await fetch(XAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(buildResponsesPayload(model, input, opts)),
      signal: xaiFetchSignal(),
    });
  } catch (e) {
    return { ok: false, error: fetchErrorMessage(e) };
  }

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

  logGrokUsage("responses", typeof data.model === "string" ? data.model : model, data);

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
  opts: GrokCompleteOptions,
): Promise<
  | { ok: true; text: string; model: string }
  | { ok: false; error: string; httpStatus?: number }
> {
  let res: Response;
  try {
    res = await fetch(XAI_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: input,
        temperature:
          typeof opts.temperature === "number"
            ? Math.min(2, Math.max(0, opts.temperature))
            : 0.8,
        max_tokens: Math.min(Math.max(opts.maxOutputTokens ?? 1024, 64), 8192),
      }),
      signal: xaiFetchSignal(),
    });
  } catch (e) {
    return { ok: false, error: fetchErrorMessage(e) };
  }

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

  logGrokUsage(
    "chat-completions",
    typeof data.model === "string" ? data.model : model,
    data,
  );

  return {
    ok: true,
    text,
    model: typeof data.model === "string" ? data.model : model,
  };
}

/**
 * Complete a chat turn via xAI. Tries Responses API first, then `/v1/chat/completions`
 * if the first call errors or returns no visible text (common when keys only allow one path).
 *
 * Default temperature 0.8: high enough for varied, alive, real-person rhythm
 * in dating-chat replies; low enough that personas stay coherent. Override
 * with `XAI_CHAT_TEMPERATURE` in env if needed.
 */
function defaultChatTemperature(): number {
  const raw = process.env.XAI_CHAT_TEMPERATURE?.trim();
  if (raw === undefined || raw === "") return 0.8;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.min(2, Math.max(0, n)) : 0.8;
}

function hasImagePart(input: GrokInputMessage[]): boolean {
  return input.some((m) => Array.isArray(m.content) && m.content.some((p) => p.type === "image_url"));
}

export async function grokResponsesComplete(
  input: GrokInputMessage[],
  options?: GrokCompleteOptions,
): Promise<{ ok: true; text: string; model: string } | { ok: false; error: string }> {
  const key = process.env.XAI_API_KEY?.trim();
  if (!key) {
    return { ok: false, error: "Missing XAI_API_KEY" };
  }
  const visionModel = process.env.XAI_VISION_MODEL?.trim();
  const baseModel = process.env.XAI_CHAT_MODEL?.trim() || "grok-4.3";
  const model = hasImagePart(input) && visionModel ? visionModel : baseModel;

  const opts: GrokCompleteOptions = {
    temperature: options?.temperature ?? defaultChatTemperature(),
    maxOutputTokens: options?.maxOutputTokens,
  };

  const withImages = hasImagePart(input);
  const maxAttempts = 3;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const first = withImages
      ? await grokViaChatCompletions(key, model, input, opts)
      : await grokViaResponses(key, model, input, opts);
    if (first.ok) return first;

    const second = withImages
      ? await grokViaResponses(key, model, input, opts)
      : await grokViaChatCompletions(key, model, input, opts);
    if (second.ok) return second;

    const combined = `${first.error} | Fallback: ${second.error}`;
    const transient =
      isTransientGrokError(first.error) || isTransientGrokError(second.error);
    if (!transient || attempt === maxAttempts - 1) {
      return { ok: false, error: combined };
    }

    await sleep(1_500 * (attempt + 1));
  }

  return { ok: false, error: "xAI request failed after retries" };
}
