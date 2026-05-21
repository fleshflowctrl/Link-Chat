import { createClient } from "@/utils/supabase/client";
import { getSupabasePublicEnv } from "@/utils/supabase/public-env";

const MAX_BYTES = 8 * 1024 * 1024;

function extForFile(file: File): string {
  const name = file.name.toLowerCase();
  if (file.type === "image/png" || name.endsWith(".png")) return "png";
  if (file.type === "image/webp" || name.endsWith(".webp")) return "webp";
  if (file.type === "image/gif" || name.endsWith(".gif")) return "gif";
  return "jpg";
}

function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  return /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(file.name);
}

export type ChatImageUploadResult =
  | { ok: true; publicUrl: string }
  | { ok: false; error: string };

/** Upload via server route (preferred — same session cookie, reliable RLS). */
async function uploadViaApi(file: File): Promise<ChatImageUploadResult> {
  const form = new FormData();
  form.append("file", file, file.name || "photo.jpg");
  const res = await fetch("/api/me/chat/upload-image", {
    method: "POST",
    credentials: "same-origin",
    body: form,
  });
  const data = (await res.json()) as {
    ok?: boolean;
    publicUrl?: string;
    error?: string;
  };
  if (!res.ok || !data.ok || !data.publicUrl) {
    return { ok: false, error: data.error ?? `Upload mislukt (${res.status})` };
  }
  return { ok: true, publicUrl: data.publicUrl };
}

/** Upload a chat photo to the `chat-images` bucket scoped to the user folder. */
export async function uploadChatImage(file: File): Promise<ChatImageUploadResult> {
  if (!isImageFile(file)) {
    return { ok: false, error: "Kies een afbeeldingsbestand" };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "Afbeelding mag maximaal 8 MB zijn" };
  }

  try {
    return await uploadViaApi(file);
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Upload mislukt",
    };
  }
}

/** Direct browser → Supabase upload (fallback when API route unavailable). */
export async function uploadChatImageDirect(file: File): Promise<ChatImageUploadResult> {
  if (!getSupabasePublicEnv()) {
    return { ok: false, error: "Supabase is niet geconfigureerd" };
  }
  if (!isImageFile(file)) {
    return { ok: false, error: "Kies een afbeeldingsbestand" };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: "Afbeelding mag maximaal 8 MB zijn" };
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
    return { ok: false, error: "Log in om foto's te sturen" };
  }

  const ext = extForFile(file);
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const path = `${user.id}/${id}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from("chat-images")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || `image/${ext}`,
    });

  if (upErr) {
    return { ok: false, error: upErr.message };
  }

  const { data } = supabase.storage.from("chat-images").getPublicUrl(path);
  return { ok: true, publicUrl: data.publicUrl };
}
