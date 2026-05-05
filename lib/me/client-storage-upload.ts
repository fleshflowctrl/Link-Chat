import { createClient } from "@/utils/supabase/client";
import { getSupabasePublicEnv } from "@/utils/supabase/public-env";

const MAX_BYTES = 5 * 1024 * 1024;

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
    return { ok: false, error: "Supabase is not configured" };
  }
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "Please choose an image file" };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "Image must be 5MB or smaller" };
  }

  let supabase: ReturnType<typeof createClient>;
  try {
    supabase = createClient();
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Could not connect",
    };
  }

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return { ok: false, error: "Sign in to upload photos" };
  }

  const ext = extForFile(file);
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const path = subfolder
    ? `${user.id}/gallery/${id}.${ext}`
    : `${user.id}/${id}.${ext}`;

  const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || `image/${ext}`,
  });

  if (upErr) {
    return { ok: false, error: upErr.message };
  }

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return { ok: true, publicUrl: data.publicUrl };
}
