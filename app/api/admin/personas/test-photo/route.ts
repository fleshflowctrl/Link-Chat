import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { generatePersonaPhoto } from "@/lib/images/generate-photo";
import { buildPersonaPhotoPrompt } from "@/lib/images/persona-photo-prompt";

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

  const scene = (typeof body.scene === "string" && body.scene.trim()) ||
    "casual selfie thuis op de bank, zachte avondverlichting, ze kijkt nipt in de camera";

  // The prompt builder expects ChatProfileRow, which has more fields than
  // our admin-form preview cares about — we cast through Record because
  // the function tolerates missing fields gracefully.
  const { prompt, seed, negativePrompt } = buildPersonaPhotoPrompt({
    profile: profile as Parameters<typeof buildPersonaPhotoPrompt>[0]["profile"],
    scene,
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
  const personaIdRaw = typeof (profile as { id?: unknown }).id === "string" ? ((profile as { id: string }).id) : "preview";
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
