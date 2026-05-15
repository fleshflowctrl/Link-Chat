import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_MIMES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_BYTES = 8 * 1024 * 1024;

function extFromMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return "png";
}

function randomSuffix(): string {
  const arr = new Uint8Array(6);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Admin-only image upload for persona avatar/gallery. Uses the service-role
 * client (bypasses RLS) so we can write to a clean `admin-personas/<id>/...`
 * path instead of forcing everything under the admin's auth.uid() folder.
 * The bucket is public-read so the returned URL works in <Image>. */
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

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Verwacht multipart/form-data." }, { status: 400 });
  }

  const file = form.get("file");
  const personaId = String(form.get("persona_id") || "").trim().toLowerCase();
  const slot = String(form.get("slot") || "avatar").trim();

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Geen bestand ontvangen." }, { status: 400 });
  }
  if (!personaId || !/^[a-z0-9_-]{1,40}$/.test(personaId)) {
    return NextResponse.json({ error: "persona_id ongeldig." }, { status: 400 });
  }
  if (!ALLOWED_MIMES.has(file.type)) {
    return NextResponse.json(
      { error: `Type niet toegestaan (${file.type || "onbekend"}).` },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Bestand te groot (max 8 MB)." }, { status: 400 });
  }

  const ext = extFromMime(file.type);
  const slug = slot === "gallery" ? "gallery" : "avatar";
  const path = `admin-personas/${personaId}/${slug}-${Date.now()}-${randomSuffix()}.${ext}`;

  const ab = await file.arrayBuffer();
  const { error } = await service.storage.from("chat-images").upload(path, Buffer.from(ab), {
    contentType: file.type,
    cacheControl: "3600",
    upsert: false,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data } = service.storage.from("chat-images").getPublicUrl(path);
  if (!data?.publicUrl) {
    return NextResponse.json({ error: "Kon public URL niet bepalen." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, url: data.publicUrl, path });
}
