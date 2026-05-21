import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;

function extForMime(mime: string, name: string): string {
  if (/png/i.test(mime) || /\.png$/i.test(name)) return "png";
  if (/webp/i.test(mime) || /\.webp$/i.test(name)) return "webp";
  if (/gif/i.test(mime) || /\.gif$/i.test(name)) return "gif";
  return "jpg";
}

function isImageUpload(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(file.name);
}

/** POST multipart `file` → public URL in `chat-images/{userId}/…`. */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Niet geautoriseerd" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Ongeldig formulier" }, { status: 400 });
  }

  const raw = form.get("file");
  if (!(raw instanceof File)) {
    return NextResponse.json({ ok: false, error: "Geen bestand" }, { status: 400 });
  }

  if (!isImageUpload(raw)) {
    return NextResponse.json(
      { ok: false, error: "Kies een afbeeldingsbestand" },
      { status: 400 },
    );
  }
  if (raw.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "Afbeelding mag maximaal 8 MB zijn" },
      { status: 400 },
    );
  }

  const ext = extForMime(raw.type, raw.name);
  const id = crypto.randomUUID();
  const path = `${user.id}/${id}.${ext}`;
  const bytes = Buffer.from(await raw.arrayBuffer());

  const { error: upErr } = await supabase.storage.from("chat-images").upload(path, bytes, {
    cacheControl: "3600",
    upsert: false,
    contentType: raw.type || `image/${ext}`,
  });

  if (upErr) {
    console.warn("[me/chat/upload-image]", upErr.message);
    return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
  }

  const { data } = supabase.storage.from("chat-images").getPublicUrl(path);
  if (!data?.publicUrl) {
    return NextResponse.json(
      { ok: false, error: "Kon geen publieke URL maken" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, publicUrl: data.publicUrl });
}
