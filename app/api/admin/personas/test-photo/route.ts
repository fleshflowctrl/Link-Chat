import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { generatePersonaPhoto } from "@/lib/images/generate-photo";
import { buildPersonaPhotoPrompt } from "@/lib/images/persona-photo-prompt";
import { pickSceneTemplate } from "@/lib/images/scene-templates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Generate a test photo from a persona-style payload (without persisting
 * any chat_messages row). Useful to preview a persona's look before saving
 * the profile, or to verify a photo_style change is producing the right
 * appearance. The image is uploaded to the public chat-images bucket so
 * the admin form can show it inline. */
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

  let body: {
    profile?: Record<string, unknown>;
    scene?: string;
    /** When the form just wants a quick visual sanity check, leave
     * scene empty and we rotate through the scene-template set. */
    slot?: "avatar" | "gallery";
    variant?: number;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON." }, { status: 400 });
  }
  const profile = body.profile;
  if (!profile || typeof profile !== "object") {
    return NextResponse.json({ error: "Geen profile-payload ontvangen." }, { status: 400 });
  }

  // Pick a scene template so test-photos also vary in setting/camera/
  // lighting instead of always producing the same indoor selfie. We
  // key on persona id (or a stable "preview" string) so repeated test
  // shots for the same persona+slot are stable.
  const personaIdRaw = typeof (profile as { id?: unknown }).id === "string"
    ? ((profile as { id: string }).id)
    : "preview";
  const slot = body.slot ?? "avatar";
  const template = pickSceneTemplate({
    personaId: personaIdRaw,
    slot,
    variant: typeof body.variant === "number" ? body.variant : Math.floor(Math.random() * 100),
  });
  const scene = (typeof body.scene === "string" && body.scene.trim()) || template.scene;

  // The prompt builder expects ChatProfileRow, which has more fields than
  // our admin-form preview cares about — we cast through Record because
  // the function tolerates missing fields gracefully.
  const { prompt, seed, negativePrompt } = buildPersonaPhotoPrompt({
    profile: profile as Parameters<typeof buildPersonaPhotoPrompt>[0]["profile"],
    scene,
    cameraStyle: {
      camera: template.camera,
      backdrop: template.backdrop,
      lighting: template.lighting,
      capture: template.capture,
    },
  });

  const result = await generatePersonaPhoto({ prompt, seed });
  if (!result.ok) {
    return NextResponse.json(
      { error: `Foto-generatie faalde: ${result.error}`, prompt, negativePrompt },
      { status: 502 },
    );
  }

  // Upload to the chat-images bucket under a preview/ path so we don't
  // pollute the live persona folders. These remain in storage forever
  // unless the admin overwrites the persona's avatar with this URL.
  const personaId = personaIdRaw.toLowerCase().replace(/[^a-z0-9_-]/g, "") || "preview";
  const ext = /png/i.test(result.mime) ? "png" : /jpe?g/i.test(result.mime) ? "jpg" : "webp";
  const path = `admin-personas/${personaId}/test-${Date.now()}.${ext}`;

  const { error: uploadError } = await service.storage
    .from("chat-images")
    .upload(path, result.bytes, { contentType: result.mime, cacheControl: "3600", upsert: false });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }
  const { data } = service.storage.from("chat-images").getPublicUrl(path);
  if (!data?.publicUrl) {
    return NextResponse.json({ error: "Kon public URL niet bepalen." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    url: data.publicUrl,
    path,
    seed: result.seed,
    backend: result.backend,
  });
}
