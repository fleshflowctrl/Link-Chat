import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { generatePersonaPhoto } from "@/lib/images/generate-photo";
import { buildPersonaPhotoPrompt } from "@/lib/images/persona-photo-prompt";
import { pickSceneTemplate } from "@/lib/images/scene-templates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Phase 3 of auto-generate: produce ONE additional gallery photo for an
 * existing persona and append the URL to her `gallery_urls` array.
 *
 * Each call generates exactly one photo so we stay under Vercel's 60s
 * function budget on cold-starts. Callers that want N gallery photos
 * (typically 3) loop the endpoint with different `variant` indices —
 * the round-robin in pickSceneTemplate guarantees no two calls in the
 * same loop pick the same scene.
 *
 * Identity continuity: we re-use the persona's `photo_style.seed` so
 * every photo (avatar + gallery) renders the same face. Only the scene
 * template + scene description change. */
export const maxDuration = 60;

type RouteCtx = { params: { id: string } };

type AppendBody = {
  /** Round-robin index — same persona+gallery+variant always lands on
   * the same scene template (idempotent retries). The client passes
   * 0,1,2 for a 3-photo gallery; or batchOffset+i for batch coordination. */
  variant?: number;
  /** Optional override scene description. When omitted, the route uses
   * the picked template's scene. */
  scene?: string;
};

export async function POST(req: Request, ctx: RouteCtx) {
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

  let body: AppendBody = {};
  try {
    if (req.headers.get("content-length") !== "0") {
      body = (await req.json()) as AppendBody;
    }
  } catch {
    // empty / malformed body is fine — we have a default template
  }

  const { data: persona, error: loadErr } = await service
    .from("chat_profiles")
    .select("*")
    .eq("id", ctx.params.id)
    .maybeSingle();
  if (loadErr) {
    return NextResponse.json({ error: loadErr.message }, { status: 500 });
  }
  if (!persona) {
    return NextResponse.json({ error: "Persona niet gevonden." }, { status: 404 });
  }

  // Pick a gallery-kind scene template (full-body, candid, activity)
  // rather than the avatar-friendly close-ups. Round-robin on `variant`
  // so a 3-photo gallery rolls 3 distinct scenes.
  const template = pickSceneTemplate({
    personaId: ctx.params.id,
    slot: "gallery",
    variant: body.variant,
  });
  const scene = (body.scene ?? "").trim() || template.scene;

  const { prompt, seed: anchorSeed, negativePrompt } = buildPersonaPhotoPrompt({
    profile: persona as Parameters<typeof buildPersonaPhotoPrompt>[0]["profile"],
    scene,
    cameraStyle: {
      camera: template.camera,
      backdrop: template.backdrop,
      lighting: template.lighting,
      capture: template.capture,
      // Per-shot outfit + pose REPLACE the persona-level style anchor
      // for this single photo. Without this, all 3 gallery shots end
      // up with the same jacket because the persona's style locks the
      // wardrobe. With this, each shot has its own outfit + pose.
      outfit: template.outfit,
      pose: template.pose,
    },
  });

  // Gallery shots use a per-variant seed offset so the diffusion noise
  // pattern actually differs between the 3 photos. Same seed + same
  // appearance produces near-identical compositions even when scene/
  // outfit prompts differ — the symptom the operator hit ("zelfde
  // pose elke foto"). The appearance + age + body anchors are strong
  // enough to keep the same-person feel across the offset.
  const variantOffset =
    typeof body.variant === "number" && Number.isFinite(body.variant)
      ? Math.floor(body.variant) * 7919 // prime so offsets don't align
      : Math.floor(Math.random() * 1_000_000);
  const seed = (anchorSeed + variantOffset) >>> 0;

  // Light log so it's clearer in the server console which template +
  // seed produced the shot, in case the operator wants to retry a
  // specific variant.
  console.log("[append-gallery-photo]", {
    persona: ctx.params.id,
    variant: body.variant,
    template: template.scene.slice(0, 60),
    seed,
    negPromptChars: negativePrompt.length,
  });

  const photo = await generatePersonaPhoto({ prompt, seed });
  if (!photo.ok) {
    return NextResponse.json(
      { error: `Foto-generatie faalde: ${photo.error}`, backend: photo.backend },
      { status: 502 },
    );
  }

  const ext = /png/i.test(photo.mime)
    ? "png"
    : /jpe?g/i.test(photo.mime)
      ? "jpg"
      : "webp";
  const path = `admin-personas/${ctx.params.id}/gallery-${Date.now()}-${
    Math.floor(Math.random() * 9999)
  }.${ext}`;
  const { error: upErr } = await service.storage
    .from("chat-images")
    .upload(path, photo.bytes, {
      contentType: photo.mime,
      cacheControl: "31536000",
      upsert: false,
    });
  if (upErr) {
    return NextResponse.json(
      { error: `Upload faalde: ${upErr.message}` },
      { status: 500 },
    );
  }
  const { data: pub } = service.storage.from("chat-images").getPublicUrl(path);
  if (!pub?.publicUrl) {
    return NextResponse.json(
      { error: "Kon public URL niet bepalen voor gallery-foto." },
      { status: 500 },
    );
  }

  // Append to gallery_urls. We re-read fresh so concurrent calls don't
  // clobber each other's appends (read-modify-write is best-effort —
  // the typical loop is sequential per persona, so contention is low).
  const existing = Array.isArray(persona.gallery_urls)
    ? (persona.gallery_urls.filter(
        (u: unknown) => typeof u === "string" && u.length > 0,
      ) as string[])
    : [];
  const nextGallery = [...existing, pub.publicUrl];

  const { error: updateErr } = await service
    .from("chat_profiles")
    .update({ gallery_urls: nextGallery })
    .eq("id", ctx.params.id);
  if (updateErr) {
    return NextResponse.json(
      {
        error: `DB-update faalde: ${updateErr.message}`,
        gallery_url: pub.publicUrl,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    gallery_url: pub.publicUrl,
    gallery_urls: nextGallery,
    seed: photo.seed,
    backend: photo.backend,
  });
}
