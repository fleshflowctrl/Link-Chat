import { NextResponse } from "next/server";
import { extractOutputText } from "@/lib/xai/parse-response-text";

const XAI_RESPONSES_URL = "https://api.x.ai/v1/responses";

type XaiErrorBody = {
  error?: { message?: string; type?: string; code?: string };
  message?: string;
};

const CREDITS_HINT =
  "Your xAI team may have no API credits yet. Open https://console.x.ai → Billing / team and add credits or a plan, then try again.";

/**
 * Diagnostic smoke test: always responds with HTTP 200 + JSON so browsers
 * show a readable body (xAI often returns 403 until billing is set up).
 */
export async function grokSmokeTestResponse() {
  const key = process.env.XAI_API_KEY;
  if (!key?.trim()) {
    return NextResponse.json({
      ok: false,
      error:
        "Missing XAI_API_KEY. In `.env.local` add a line exactly: XAI_API_KEY=xai-...your-secret (not the key's display name in the dashboard). Restart `npm run dev`.",
    });
  }

  try {
    const res = await fetch(XAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key.trim()}`,
      },
      body: JSON.stringify({
        model: "grok-4.3",
        input: [
          {
            role: "system",
            content:
              "You are Grok. Reply briefly for an API connectivity test only.",
          },
          { role: "user", content: "Reply in exactly five words." },
        ],
      }),
    });

    const raw = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return NextResponse.json({
        ok: false,
        xaiHttpStatus: res.status,
        error: "Non-JSON response from xAI",
        bodyPreview: raw.slice(0, 400),
      });
    }

    if (!res.ok) {
      const err = data as XaiErrorBody;
      const msg =
        err.error?.message ??
        err.message ??
        (typeof data === "object" ? JSON.stringify(data) : "Request failed");
      const lower = msg.toLowerCase();
      const creditsIssue =
        lower.includes("credit") ||
        lower.includes("license") ||
        lower.includes("permission");
      return NextResponse.json({
        ok: false,
        xaiHttpStatus: res.status,
        error: msg,
        ...(creditsIssue ? { hint: CREDITS_HINT } : {}),
      });
    }

    const reply = extractOutputText(data);
    if (!reply) {
      return NextResponse.json({
        ok: true,
        warning:
          "Request succeeded but reply text could not be parsed; inspect `rawKeys`.",
        rawKeys: Object.keys(data),
        rawPreview: JSON.stringify(data).slice(0, 800),
      });
    }

    return NextResponse.json({
      ok: true,
      model: typeof data.model === "string" ? data.model : "grok-4.3",
      reply,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message });
  }
}
