import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { generatePersonaPhoto } from "@/lib/images/generate-photo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 90;

/**
 * Admin image-lab generator.
 *
 * Runs an arbitrary prompt through the active image backend (Z-Image-Turbo
 * by default) with operator-supplied width, height, steps, seed and an
 * option to skip the phone-finish post-processing pass — so the operator
 * can compare raw-model output vs the finished pipeline, then iterate on
 * the prompt to find a more stable / more realistic baseline before
 * touching persona defaults.
 */

type Body = {
  prompt?: unknown;
  negativePrompt?: unknown;
  seed?: unknown;
  width?: unknown;
  height?: unknown;
  steps?: unknown;
  skipFinish?: unknown;
  blurSigma?: unknown;
  grainOpacity?: unknown;
  grainStrength?: unknown;
};

function toFiniteNumber(v: unknown): number | undefined {
  if (typeof v !== "number" || !Number.isFinite(v)) return undefined;
  return v;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const service = getServiceSupabase();
  if (!service) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY ontbreekt." },
      { status: 500 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON." }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return NextResponse.json({ error: "Prompt is leeg." }, { status: 400 });
  }
  if (prompt.length > 2000) {
    return NextResponse.json(
      { error: "Prompt te lang (max 2000 tekens)." },
      { status: 400 },
    );
  }

  const negativePrompt =
    typeof body.negativePrompt === "string" ? body.negativePrompt.trim() : "";

  const rawSeed = toFiniteNumber(body.seed);
  const seed =
    typeof rawSeed === "number" ? Math.floor(Math.max(0, rawSeed)) : undefined;

  // Z-Image-Turbo allows 512–2048. Cap to safe values that don't OOM the Space.
  const width = clamp(toFiniteNumber(body.width) ?? 768, 512, 1536);
  const height = clamp(toFiniteNumber(body.height) ?? 1024, 512, 1536);
  const steps = clamp(toFiniteNumber(body.steps) ?? 9, 4, 32);

  const skipFinish = body.skipFinish === true;
  const finishOpts =
    skipFinish
      ? undefined
      : {
          blurSigma: clamp(toFiniteNumber(body.blurSigma) ?? 0.45, 0, 3),
          grainOpacity: clamp(toFiniteNumber(body.grainOpacity) ?? 0.14, 0, 1),
          grainStrength: clamp(toFiniteNumber(body.grainStrength) ?? 36, 0, 80),
        };

  const start = Date.now();
  const result = await generatePersonaPhoto({
    prompt,
    negativePrompt: negativePrompt || undefined,
    seed,
    width,
    height,
    steps,
    skipFinish,
    finishOpts,
  });
  const elapsedMs = Date.now() - start;

  if (!result.ok) {
    return NextResponse.json(
      {
        error: `Foto-generatie faalde: ${result.error}`,
        backend: result.backend,
        elapsedMs,
      },
      { status: 502 },
    );
  }

  const ext = /png/i.test(result.mime)
    ? "png"
    : /jpe?g/i.test(result.mime)
      ? "jpg"
      : "webp";
  const path = `admin-image-lab/${Date.now()}-${result.seed}.${ext}`;

  const { error: uploadError } = await service.storage
    .from("chat-images")
    .upload(path, result.bytes, {
      contentType: result.mime,
      cacheControl: "3600",
      upsert: false,
    });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }
  const { data } = service.storage.from("chat-images").getPublicUrl(path);
  if (!data?.publicUrl) {
    return NextResponse.json(
      { error: "Kon public URL niet bepalen." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    url: data.publicUrl,
    path,
    seed: result.seed,
    backend: result.backend,
    width,
    height,
    steps,
    skipFinish,
    elapsedMs,
  });
}
