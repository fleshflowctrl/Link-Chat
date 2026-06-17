import type { SupabaseClient } from "@supabase/supabase-js";
import { swapPersonaAvatarWithGallery } from "@/lib/admin/swap-persona-avatar-gallery";

export const CHAT_IMAGES_BUCKET = "chat-images";

export const PROFILE_ASSET_VARIANTS = ["v1", "v2"] as const;
export type ProfileAssetVariant = (typeof PROFILE_ASSET_VARIANTS)[number];

export type ProfileAssetItem = {
  name: string;
  path: string;
  url: string;
  updatedAt: string | null;
};

export type ExistingPersonaPhoto = {
  url: string;
  personaId: string;
  personaName: string;
  kind: "avatar" | "gallery";
  onlineNow: boolean;
  isArchived: boolean;
};

export type LiveMapProfile = {
  id: string;
  display_name: string;
  avatar_url: string;
  age: number | null;
  city: string | null;
  liveAssetPath: string | null;
  liveAssetUrl: string | null;
};

export type PersonaPickerRow = {
  id: string;
  display_name: string;
  avatar_url: string;
  age: number | null;
  city: string | null;
  online_now: boolean;
  is_archived: boolean;
};

const IMAGE_EXT = /\.(jpe?g|png|webp|gif)$/i;

export function isProfileAssetVariant(v: string): v is ProfileAssetVariant {
  return v === "v1" || v === "v2";
}

/** Bibliotheek — alle bestaande profielfoto's (virtuele map, uit database). */
export function profileAssetsArchiveFolder(variant: ProfileAssetVariant): string {
  return `profile-assets/${variant}/archive`;
}

/** Live profielen — aparte storage-map, los van de bibliotheek. */
export function liveProfilesFolder(variant: ProfileAssetVariant): string {
  return `live-profiles/${variant}`;
}

export function liveProfileAssetPath(
  variant: ProfileAssetVariant,
  personaId: string,
): string {
  return `${liveProfilesFolder(variant)}/${personaId}.jpg`;
}

async function listStorageImages(
  service: SupabaseClient,
  folder: string,
): Promise<ProfileAssetItem[]> {
  const { data, error } = await service.storage.from(CHAT_IMAGES_BUCKET).list(folder, {
    limit: 500,
    sortBy: { column: "updated_at", order: "desc" },
  });
  if (error) throw new Error(error.message);

  return (data ?? [])
    .filter((f) => f.name && IMAGE_EXT.test(f.name) && f.id !== null)
    .map((f) => {
      const path = `${folder}/${f.name}`;
      const { data: pub } = service.storage.from(CHAT_IMAGES_BUCKET).getPublicUrl(path);
      return {
        name: f.name,
        path,
        url: pub.publicUrl,
        updatedAt: f.updated_at ?? f.created_at ?? null,
      };
    });
}

export async function listLiveMapFiles(
  service: SupabaseClient,
  variant: ProfileAssetVariant,
): Promise<ProfileAssetItem[]> {
  return listStorageImages(service, liveProfilesFolder(variant));
}

export async function collectExistingPersonaPhotos(
  service: SupabaseClient,
  variant: ProfileAssetVariant,
): Promise<ExistingPersonaPhoto[]> {
  const { data, error } = await service
    .from("chat_profiles")
    .select("id, display_name, avatar_url, gallery_urls, app_variant, online_now, is_archived")
    .eq("is_ai", true)
    .eq("app_variant", variant)
    .order("is_archived", { ascending: true })
    .order("display_name", { ascending: true });

  if (error) throw new Error(error.message);

  const seen = new Set<string>();
  const out: ExistingPersonaPhoto[] = [];

  for (const row of data ?? []) {
    const personaId = String((row as { id: string }).id);
    const personaName = String((row as { display_name: string }).display_name ?? personaId);
    const onlineNow = Boolean((row as { online_now?: boolean }).online_now);
    const isArchived = Boolean((row as { is_archived?: boolean }).is_archived);
    const avatar = String((row as { avatar_url?: string }).avatar_url ?? "").trim();
    const gallery = Array.isArray((row as { gallery_urls?: unknown }).gallery_urls)
      ? ((row as { gallery_urls: unknown[] }).gallery_urls.filter(
          (u): u is string => typeof u === "string" && u.length > 0,
        ))
      : [];

    if (avatar && !seen.has(avatar)) {
      seen.add(avatar);
      out.push({ url: avatar, personaId, personaName, kind: "avatar", onlineNow, isArchived });
    }
    for (const url of gallery) {
      if (!seen.has(url)) {
        seen.add(url);
        out.push({ url, personaId, personaName, kind: "gallery", onlineNow, isArchived });
      }
    }
  }

  return out;
}

export async function fetchLiveMapProfiles(
  service: SupabaseClient,
  variant: ProfileAssetVariant,
): Promise<LiveMapProfile[]> {
  const { data, error } = await service
    .from("chat_profiles")
    .select("id, display_name, avatar_url, age, city, online_now")
    .eq("is_ai", true)
    .eq("app_variant", variant)
    .eq("online_now", true)
    .eq("is_archived", false)
    .order("display_name", { ascending: true });

  if (error) throw new Error(error.message);

  const liveFiles = await listLiveMapFiles(service, variant);
  const liveByPersonaId = new Map<string, ProfileAssetItem>();
  for (const file of liveFiles) {
    const personaId = file.name.replace(/\.[^.]+$/, "");
    if (personaId) liveByPersonaId.set(personaId, file);
  }

  return (data ?? []).map((row) => {
    const id = String((row as { id: string }).id);
    const avatar = String((row as { avatar_url?: string }).avatar_url ?? "");
    const liveFile = liveByPersonaId.get(id) ?? null;
    return {
      id,
      display_name: String((row as { display_name: string }).display_name ?? ""),
      avatar_url: avatar,
      age: typeof (row as { age?: number }).age === "number" ? (row as { age: number }).age : null,
      city:
        typeof (row as { city?: string }).city === "string"
          ? (row as { city: string }).city
          : null,
      liveAssetPath: liveFile?.path ?? null,
      liveAssetUrl: liveFile?.url ?? null,
    };
  });
}

export async function fetchPersonasForPicker(
  service: SupabaseClient,
  variant: ProfileAssetVariant,
): Promise<PersonaPickerRow[]> {
  const { data, error } = await service
    .from("chat_profiles")
    .select("id, display_name, avatar_url, age, city, online_now, is_archived")
    .eq("is_ai", true)
    .eq("app_variant", variant)
    .order("online_now", { ascending: true })
    .order("is_archived", { ascending: true })
    .order("display_name", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: String((row as { id: string }).id),
    display_name: String((row as { display_name: string }).display_name ?? ""),
    avatar_url: String((row as { avatar_url?: string }).avatar_url ?? ""),
    age: typeof (row as { age?: number }).age === "number" ? (row as { age: number }).age : null,
    city:
      typeof (row as { city?: string }).city === "string" ? (row as { city: string }).city : null,
    online_now: Boolean((row as { online_now?: boolean }).online_now),
    is_archived: Boolean((row as { is_archived?: boolean }).is_archived),
  }));
}

export async function copyImageToStoragePath(
  service: SupabaseClient,
  sourceUrl: string,
  destPath: string,
): Promise<string> {
  const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) {
    throw new Error(`Download HTTP ${res.status}`);
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  const mime = res.headers.get("content-type") || "image/jpeg";
  const { error: upErr } = await service.storage.from(CHAT_IMAGES_BUCKET).upload(destPath, bytes, {
    contentType: mime,
    cacheControl: "31536000",
    upsert: true,
  });
  if (upErr) throw new Error(upErr.message);

  const { data } = service.storage.from(CHAT_IMAGES_BUCKET).getPublicUrl(destPath);
  if (!data?.publicUrl) {
    throw new Error("Kon public URL niet bepalen.");
  }
  return data.publicUrl;
}

export async function publishPersonaToLive(
  service: SupabaseClient,
  input: {
    variant: ProfileAssetVariant;
    personaId: string;
  },
): Promise<{ liveUrl: string; livePath: string }> {
  const { data: row, error: loadErr } = await service
    .from("chat_profiles")
    .select("id, avatar_url, app_variant")
    .eq("id", input.personaId)
    .maybeSingle();

  if (loadErr) throw new Error(loadErr.message);
  if (!row) throw new Error("Profiel niet gevonden.");

  const rowVariant =
    (row as { app_variant?: string }).app_variant === "v2" ? "v2" : "v1";
  if (rowVariant !== input.variant) {
    throw new Error(
      `Dit profiel hoort bij ${rowVariant.toUpperCase()}, niet ${input.variant.toUpperCase()}.`,
    );
  }

  const avatarUrl = String((row as { avatar_url?: string }).avatar_url ?? "").trim();
  if (!avatarUrl) {
    throw new Error("Dit profiel heeft nog geen foto. Upload eerst een foto via Personas.");
  }

  const livePath = liveProfileAssetPath(input.variant, input.personaId);
  const liveUrl = await copyImageToStoragePath(service, avatarUrl, livePath);

  const { error: updateErr } = await service
    .from("chat_profiles")
    .update({
      avatar_url: liveUrl,
      online_now: true,
      is_archived: false,
      status_variant: "online",
      status_label: "Online nu",
      last_active_label: "Nu actief",
      filter_tags: ["online", "active"],
    })
    .eq("id", input.personaId);

  if (updateErr) throw new Error(updateErr.message);

  return { liveUrl, livePath };
}

/** @deprecated gebruik publishPersonaToLive */
export async function publishPhotoToLive(
  service: SupabaseClient,
  input: {
    variant: ProfileAssetVariant;
    photoUrl: string;
    personaId: string;
  },
): Promise<{ liveUrl: string; avatarUrl: string; livePath: string }> {
  const { data: row, error: loadErr } = await service
    .from("chat_profiles")
    .select("id, avatar_url, gallery_urls, app_variant")
    .eq("id", input.personaId)
    .maybeSingle();

  if (loadErr) throw new Error(loadErr.message);
  if (!row) throw new Error("Profiel niet gevonden.");

  const rowVariant =
    (row as { app_variant?: string }).app_variant === "v2" ? "v2" : "v1";
  if (rowVariant !== input.variant) {
    throw new Error(
      `Dit profiel hoort bij ${rowVariant.toUpperCase()}, niet ${input.variant.toUpperCase()}.`,
    );
  }

  const livePath = liveProfileAssetPath(input.variant, input.personaId);
  const liveUrl = await copyImageToStoragePath(service, input.photoUrl, livePath);

  const stamp = Date.now();
  const personaAvatarPath = `admin-personas/${input.personaId}/live-avatar-${stamp}.jpg`;
  const avatarUrl = await copyImageToStoragePath(service, input.photoUrl, personaAvatarPath);

  const previousAvatar =
    typeof (row as { avatar_url?: string }).avatar_url === "string"
      ? (row as { avatar_url: string }).avatar_url
      : "";
  const gallery = Array.isArray((row as { gallery_urls?: unknown }).gallery_urls)
    ? ((row as { gallery_urls: unknown[] }).gallery_urls.filter(
        (u): u is string => typeof u === "string" && u.length > 0,
      ))
    : [];

  const next = swapPersonaAvatarWithGallery(previousAvatar, gallery, avatarUrl);

  const { error: updateErr } = await service
    .from("chat_profiles")
    .update({
      avatar_url: next.avatar_url,
      gallery_urls: next.gallery_urls,
      online_now: true,
      is_archived: false,
      status_variant: "online",
      status_label: "Online nu",
      last_active_label: "Nu actief",
      filter_tags: ["online", "active"],
    })
    .eq("id", input.personaId);

  if (updateErr) throw new Error(updateErr.message);

  return { liveUrl, avatarUrl: next.avatar_url, livePath };
}

export async function syncLiveMapState(
  service: SupabaseClient,
  variant: ProfileAssetVariant,
): Promise<void> {
  const liveFiles = await listLiveMapFiles(service, variant);
  const liveById = new Map(
    liveFiles
      .map((f) => {
        const id = f.name.replace(/\.[^.]+$/, "");
        return id ? ([id, f] as const) : null;
      })
      .filter((x): x is readonly [string, ProfileAssetItem] => x !== null),
  );

  const { data: variantRows, error } = await service
    .from("chat_profiles")
    .select("id, online_now")
    .eq("is_ai", true)
    .eq("app_variant", variant);

  if (error) throw new Error(error.message);

  for (const row of variantRows ?? []) {
    const id = String((row as { id: string }).id);
    const file = liveById.get(id);
    const wasOnline = Boolean((row as { online_now?: boolean }).online_now);

    if (file) {
      await service
        .from("chat_profiles")
        .update({
          avatar_url: file.url,
          online_now: true,
          is_archived: false,
          status_variant: "online",
          status_label: "Online nu",
          last_active_label: "Nu actief",
          filter_tags: ["online", "active"],
        })
        .eq("id", id);
      liveById.delete(id);
    } else if (wasOnline) {
      await unpublishPersonaFromLive(service, id, variant);
    }
  }
}

export async function unpublishPersonaFromLive(
  service: SupabaseClient,
  personaId: string,
  variant?: ProfileAssetVariant,
): Promise<void> {
  const { error } = await service
    .from("chat_profiles")
    .update({
      online_now: false,
      status_variant: "quiet",
      status_label: "Offline",
      last_active_label: "Niet actief",
      filter_tags: ["more"],
    })
    .eq("id", personaId);

  if (error) throw new Error(error.message);

  if (variant) {
    const path = liveProfileAssetPath(variant, personaId);
    await service.storage.from(CHAT_IMAGES_BUCKET).remove([path]);
  }
}
