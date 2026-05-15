import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Diagnose how the image-generation pipeline is configured at runtime.
 *
 * The operator's #1 question after a 504 / placeholder-avatar incident
 * is "is my HF token even being used?". This endpoint answers that
 * without exposing the secret value of the token itself:
 *   - which IMAGE_BACKEND is selected
 *   - whether HF_TOKEN is present
 *   - if so, which HuggingFace account it belongs to (call /whoami-v2)
 *
 * Connecting to the Space itself is intentionally NOT done here because
 * a cold-start can take 60-90s — way too long for a UI ping. Use the
 * Bulk-generate flow's photo phase to verify actual generation. */
export const maxDuration = 15;

const HF_WHOAMI_URL = "https://huggingface.co/api/whoami-v2";
const HF_SPACE = "mrfakename/Z-Image-Turbo";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const backendRaw = (process.env.IMAGE_BACKEND || "hf-space").toLowerCase();
  const tokenRaw = process.env.HF_TOKEN?.trim();
  const tokenPresent = Boolean(tokenRaw);

  const result: {
    backend: string;
    hf: {
      space: string;
      token_present: boolean;
      token_hint?: string;
      account?: {
        name?: string;
        type?: string;
        id?: string;
        is_pro?: boolean;
        plan?: string;
      };
      account_error?: string;
    };
  } = {
    backend: backendRaw,
    hf: {
      space: HF_SPACE,
      token_present: tokenPresent,
    },
  };

  // Don't echo the full token — give the operator just enough to
  // distinguish two tokens. (First/last 4 chars, total length.)
  if (tokenPresent && tokenRaw) {
    const head = tokenRaw.slice(0, 4);
    const tail = tokenRaw.slice(-4);
    result.hf.token_hint = `${head}…${tail} (${tokenRaw.length} chars)`;

    try {
      const res = await fetch(HF_WHOAMI_URL, {
        headers: {
          Authorization: `Bearer ${tokenRaw}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        result.hf.account_error = `whoami HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`;
      } else {
        const data = (await res.json()) as Record<string, unknown>;
        const periodicity = (data.periodicSubscription as Record<string, unknown> | undefined) ?? null;
        result.hf.account = {
          name: typeof data.name === "string" ? data.name : undefined,
          type: typeof data.type === "string" ? data.type : undefined,
          id: typeof data.id === "string" ? data.id : undefined,
          is_pro: typeof data.isPro === "boolean" ? data.isPro : undefined,
          plan: typeof periodicity?.plan === "string" ? (periodicity.plan as string) : undefined,
        };
      }
    } catch (e) {
      result.hf.account_error = e instanceof Error ? e.message : String(e);
    }
  }

  return NextResponse.json(result);
}
