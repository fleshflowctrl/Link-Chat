/**
 * Upload a generated persona photo to Supabase Storage.
 *
 * Path convention:
 *   {owner_user_id}/peer-photos/{peer_id}/{uuid}.{ext}
 *
 * The first segment is the OWNER's auth.uid() so the existing
 * `chat_images_insert_own_folder` policy (defined in 20260514130000)
 * accepts the upload — the persona itself isn't authenticated, but the
 * server-side route that triggers generation IS, so uploads happen on
 * behalf of the user.
 *
 * The `chat-images` bucket is public-read, so `getPublicUrl()` yields a
 * URL we can drop straight into chat_messages.image_url.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type UploadPersonaPhotoResult =
  | { ok: true; publicUrl: string; path: string }
  | { ok: false; error: string };

/** Generate a short random suffix for the storage filename. We don't need
 * crypto-strength uniqueness (the {uuid} from chat_messages is already
 * unique), but a short hex blob keeps urls clean. */
function randomSuffix(): string {
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

function extFromMime(mime: string): string {
  if (/png/i.test(mime)) return "png";
  if (/jpe?g/i.test(mime)) return "jpg";
  if (/webp/i.test(mime)) return "webp";
  return "png";
}

export async function uploadPersonaPhoto(
  supabase: SupabaseClient,
  args: {
    ownerUserId: string;
    peerId: string;
    bytes: Buffer;
    mime: string;
  },
): Promise<UploadPersonaPhotoResult> {
  const ext = extFromMime(args.mime);
  const path = `${args.ownerUserId}/peer-photos/${args.peerId}/${Date.now()}-${randomSuffix()}.${ext}`;

  const { error } = await supabase.storage
    .from("chat-images")
    .upload(path, args.bytes, {
      contentType: args.mime,
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    return { ok: false, error: error.message };
  }

  const { data } = supabase.storage.from("chat-images").getPublicUrl(path);
  if (!data?.publicUrl) {
    return { ok: false, error: "Could not derive public URL" };
  }
  return { ok: true, publicUrl: data.publicUrl, path };
}
