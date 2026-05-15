import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { generatePersonaPhoto } from "@/lib/images/generate-photo";
import { buildPersonaPhotoPrompt } from "@/lib/images/persona-photo-prompt";
import { pickSceneTemplate } from "@/lib/images/scene-templates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Phase 2 of auto-generate: produce the actual Z-Image-Turbo portrait
 * for a persona that was just created with an initials-placeholder, and
 * swap her avatar_url to the real photo.
 *
 * This runs in its own request so the Z-Image-Turbo cold-start (often
 * 60-90s on a cold HF Space) doesn't co-occupy the budget that Grok +
 * the DB insert already need. The client calls this once per persona
 * after phase 1 is fully done.
 *
 * 60s is the maximum on Vercel Pro and the largest practical budget for
 * a single image generation. If the Space is still cold past that, we
 * surface a 504-ish error to the client which keeps the existing
 * placeholder avatar; the operator can retry from the persona's edit
 * page. */
export const maxDuration = 60;

type RouteCtx = { params: { id: string } };

type RegenerateBody = {
  /** Optional override scene description. When omitted, the route picks
   * a deterministic scene template (varies setting/camera/lighting per
   * persona+slot) so we get full-body, mirror selfies, café candids,
   * etc. instead of always the same front-camera selfie. */
  scene?: string;
  /** Slot — "avatar" biases toward face-forward shots so the profile
   * photo is always recognizable. "gallery" uses the full set with
   * full-body and activity shots. Defaults to "avatar". */
  slot?: "avatar" | "gallery";
  /** Variant index for rotation. Same persona+slot+variant always
   * yields the same template (idempotent retries). Bump to roll a
   * different look. */
  variant?: number;
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

  let body: RegenerateBody = {};
  try {
    if (req.headers.get("content-length") !== "0") {
      body = (await req.json()) as RegenerateBody;
    }
  } catch {
    // Empty / malformed body is fine — we have a default template.
  }

  // Load the persona row so we can build the prompt from her real
  // photo_style anchor (appearance, build, style, vibe, seed). Without
  // this the regenerated photo wouldn't be visually consistent with
  // future photos for the same persona.
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

  // Pick a scene template — deterministic per persona+slot+variant so
  // retries are stable, but different personas roll different looks
  // and the operator can bump `variant` to cycle through the set.
  const slot = body.slot ?? "avatar";
  const template = pickSceneTemplate({
    personaId: ctx.params.id,
    slot,
    variant: body.variant,
  });
  const scene = (body.scene ?? "").trim() || template.scene;

  const { prompt, seed } = buildPersonaPhotoPrompt({
    profile: persona as Parameters<typeof buildPersonaPhotoPrompt>[0]["profile"],
    scene,
    cameraStyle: {
      camera: template.camera,
      backdrop: template.backdrop,
      lighting: template.lighting,
      capture: template.capture,
      outfit: template.outfit,
      pose: template.pose,
    },
  });

  const photo = await generatePersonaPhoto({ prompt, seed });
  if (!photo.ok) {
    return NextResponse.json(
      {
        error: `Foto-generatie faalde: ${photo.error}`,
        backend: photo.backend,
      },
      { status: 502 },
    );
  }

  const ext = /png/i.test(photo.mime)
    ? "png"
    : /jpe?g/i.test(photo.mime)
      ? "jpg"
      : "webp";
  const path = `admin-personas/${ctx.params.id}/avatar-${Date.now()}.${ext}`;
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
      { error: "Kon public URL niet bepalen voor avatar." },
      { status: 500 },
    );
  }

  // Swap the avatar. We only update avatar_url (not photo_style.seed) so
  // future regenerations stay visually consistent with this one.
  const { error: updateErr } = await service
    .from("chat_profiles")
    .update({ avatar_url: pub.publicUrl })
    .eq("id", ctx.params.id);
  if (updateErr) {
    return NextResponse.json(
      { error: `DB-update faalde: ${updateErr.message}`, avatar_url: pub.publicUrl },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    avatar_url: pub.publicUrl,
    seed: photo.seed,
    backend: photo.backend,
  });
}
