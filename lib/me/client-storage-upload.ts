import { createClient } from "@/utils/supabase/client";
import { getSupabasePublicEnv } from "@/utils/supabase/public-env";
import { resizeImageForUpload } from "@/lib/me/client-image-resize";

// Generous safety net — most phone photos are 6–12 MB raw, but we resize
// client-side before uploading so the actual payload is usually < 1 MB.
const MAX_BYTES = 15 * 1024 * 1024;

function extForFile(file: File): string {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  return "jpg";
}

export type UploadResult =
  | { ok: true; publicUrl: string }
  | { ok: false; error: string };

/**
 * Upload a profile image to Supabase Storage (`avatars` bucket).
 * Path is `{userId}/{subfolder?}/{uuid}.ext` — must match storage RLS.
 */
export async function uploadProfileImage(
  file: File,
  subfolder?: "gallery",
): Promise<UploadResult> {
  if (!getSupabasePublicEnv()) {
    return { ok: false, error: "Supabase is niet geconfigureerd" };
  }
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "Kies een afbeeldingsbestand" };
  }

  // Downscale before checking the size cap so photos that are large only
  // because of camera resolution can still upload.
  const prepared = await resizeImageForUpload(file).catch(() => file);

  if (prepared.size > MAX_BYTES) {
    return { ok: false, error: "Afbeelding is te groot (max 15 MB)" };
  }

  let supabase: ReturnType<typeof createClient>;
  try {
    supabase = createClient();
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Kan geen verbinding maken",
    };
  }

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return { ok: false, error: "Log in om foto’s te uploaden" };
  }

  const ext = extForFile(prepared);
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const path = subfolder
    ? `${user.id}/gallery/${id}.${ext}`
    : `${user.id}/${id}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, prepared, {
      cacheControl: "3600",
      upsert: false,
      contentType: prepared.type || `image/${ext}`,
    });

  if (upErr) {
    return { ok: false, error: upErr.message };
  }

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return { ok: true, publicUrl: data.publicUrl };
}
