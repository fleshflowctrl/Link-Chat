/**
 * Reusable persona pipeline operations.
 *
 * Each of the three phases of the auto-generate flow used to live entirely
 * inside its own /api/admin/personas/* route handler. That worked fine while
 * the BulkGenerateCard ran everything client-side, but the new background
 * worker (`/api/admin/personas/batch/tick`) needs to be able to invoke the
 * same code paths without re-issuing internal HTTP requests (each round-trip
 * eats budget against Vercel's 60s function cap, and authenticating worker
 * requests as the admin would require carrying the session cookie forward).
 *
 * So the actual work happens here, and both the public route handlers and
 * the worker call into these functions. The routes still own their own
 * HTTP-shaped error responses and auth checks; this module just does the
 * heavy lifting.
 */

import { randomInt } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { generatePersonaFromBrief } from "@/lib/admin/generate-persona";
import { uploadFallbackAvatar } from "@/lib/admin/fallback-avatar";
import { parsePersonaPayload } from "@/lib/admin/persona-payload";
import { generatePersonaPhoto } from "@/lib/images/generate-photo";
import { buildPersonaPhotoPrompt } from "@/lib/images/persona-photo-prompt";
import { pickFreshSceneTemplate } from "@/lib/images/scene-templates";
import { pickFreshNudeTemplates } from "@/lib/images/nude-scene-templates";
import {
  loadActiveTemplatesForSlot,
  loadActiveNudeTemplates,
  recordAndConsumeSceneTemplateUse,
} from "@/lib/admin/scene-templates-store";

export type Attractiveness = "striking" | "average" | "plain";
export type BodyType = "slim" | "average" | "plus";

export type CreatePersonaInput = {
  brief: string;
  index: number;
  total: number;
  exclude: string[];
  attractiveness: Attractiveness;
  body_type: BodyType;
  age_min: number;
  age_max: number;
};

export type CreatePersonaSummary = {
  id: string;
  display_name: string;
  age: number;
  city: string;
  occupation: string | null;
  avatar_url: string;
  photo_pending: true;
};

export type CreatePersonaResult =
  | { ok: true; persona: CreatePersonaSummary; warning: string | null }
  | { ok: false; error: string; status?: number };

/** Resolve a slug that doesn't collide with an existing chat_profiles row.
 * Suffixes -2, -3, ... up to -9 if needed; if all are taken we hash a
 * short random tail so the operator at least gets a usable id. */
async function resolveUniqueId(
  service: SupabaseClient,
  proposed: string,
): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const candidate = i === 0 ? proposed : `${proposed}-${i + 1}`;
    const { data } = await service
      .from("chat_profiles")
      .select("id")
      .eq("id", candidate)
      .maybeSingle();
    if (!data) return candidate;
  }
  const tail = Math.random().toString(36).slice(2, 6);
  return `${proposed}-${tail}`;
}

/** Phase 1: Grok writes the persona, we upload an initials avatar, and
 * we insert the row. Avatar regen + gallery photos happen in later phases. */
export async function createPersonaFromBrief(
  service: SupabaseClient,
  input: CreatePersonaInput,
): Promise<CreatePersonaResult> {
  // Pick a random age inside the operator's range (server-side, so the
  // worker and the legacy route give the same behaviour).
  const lo = Math.max(18, Math.min(99, Math.round(Math.min(input.age_min, input.age_max))));
  const hi = Math.max(18, Math.min(99, Math.round(Math.max(input.age_min, input.age_max))));
  const forcedAge = lo + Math.floor(Math.random() * (hi - lo + 1));

  const generated = await generatePersonaFromBrief({
    brief: input.brief,
    index: input.index,
    total: input.total,
    exclude: input.exclude,
    attractiveness: input.attractiveness,
    body_type: input.body_type,
    forced_age: forcedAge,
  });
  if (!generated.ok) {
    return { ok: false, error: `Generatie faalde: ${generated.error}`, status: 502 };
  }

  const uniqueId = await resolveUniqueId(service, generated.persona.id);

  // Force a crypto-random photo seed. Grok occasionally writes the same
  // seed value across personas (it likes round numbers like 12345/54321),
  // and the diffusion seed drives identity — same seed = same face.
  // Overriding here guarantees batch-wide seed uniqueness.
  generated.persona.photo_style.seed = randomInt(100_000, 999_999_999);

  const fallback = await uploadFallbackAvatar(
    service,
    uniqueId,
    generated.persona.display_name,
  );
  let avatarUrl = "";
  let warning: string | null = null;
  if (fallback.ok) {
    avatarUrl = fallback.url;
  } else {
    const placeholder = process.env.ADMIN_PERSONA_PLACEHOLDER_AVATAR_URL?.trim();
    if (placeholder && /^https?:\/\//i.test(placeholder)) {
      avatarUrl = placeholder;
      warning = `Initialen-avatar upload faalde (${fallback.error}); placeholder gebruikt.`;
    } else {
      return {
        ok: false,
        error: `Avatar-upload faalde: ${fallback.error}`,
        status: 500,
      };
    }
  }

  const payload = {
    id: uniqueId,
    display_name: generated.persona.display_name,
    age: generated.persona.age,
    city: generated.persona.city,
    bio: generated.persona.bio,
    occupation: generated.persona.occupation,
    backstory: generated.persona.backstory,
    looking_for: generated.persona.looking_for,
    avatar_url: avatarUrl,
    gallery_urls: [],
    interests: generated.persona.interests,
    vibe_tags: generated.persona.vibe_tags,
    funnel_intent_ids: generated.persona.funnel_intent_ids,
    filter_tags: generated.persona.filter_tags,
    status_variant: generated.persona.status_variant,
    status_label: generated.persona.status_label,
    last_active_label: "Active today",
    home_sort: 100,
    joined_at: new Date().toISOString(),
    distance_km: 4,
    verified: true,
    online_now: generated.persona.status_variant === "online",
    is_archived: false,
    chat_style: generated.persona.chat_style,
    photo_style: generated.persona.photo_style,
    persona_meta: generated.persona.persona_meta,
  };

  const parsed = parsePersonaPayload(payload, { mode: "create" });
  if (!parsed.ok) {
    return { ok: false, error: `Validatie faalde: ${parsed.error}`, status: 422 };
  }

  const { error: insertError } = await service
    .from("chat_profiles")
    .insert(parsed.row);
  if (insertError) {
    return {
      ok: false,
      error: `Insert faalde: ${insertError.message}`,
      status: 500,
    };
  }

  return {
    ok: true,
    persona: {
      id: parsed.row.id,
      display_name: parsed.row.display_name,
      age: parsed.row.age,
      city: parsed.row.city,
      occupation: parsed.row.occupation,
      avatar_url: parsed.row.avatar_url,
      photo_pending: true,
    },
    warning,
  };
}

export type RegenerateAvatarInput = {
  personaId: string;
  variant?: number;
  scene?: string;
};

export type RegenerateAvatarResult =
  | { ok: true; avatar_url: string; seed: number; backend: string }
  | { ok: false; error: string; status?: number };

/** Phase 2: render the real avatar and swap avatar_url. */
export async function regeneratePersonaAvatar(
  service: SupabaseClient,
  input: RegenerateAvatarInput,
): Promise<RegenerateAvatarResult> {
  const { data: persona, error: loadErr } = await service
    .from("chat_profiles")
    .select("*")
    .eq("id", input.personaId)
    .maybeSingle();
  if (loadErr) return { ok: false, error: loadErr.message, status: 500 };
  if (!persona) return { ok: false, error: "Persona niet gevonden.", status: 404 };

  const avatarPool = await loadActiveTemplatesForSlot(service, "avatar");
  const picked = await pickFreshSceneTemplate({
    service,
    personaId: input.personaId,
    slot: "avatar",
    attempt: 0,
    fallbackVariant: input.variant,
    pool: avatarPool,
  });
  const template = picked.template;
  const scene = (input.scene ?? "").trim() || template.scene;

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
    return {
      ok: false,
      error: `Foto-generatie faalde: ${photo.error}`,
      status: 502,
    };
  }

  const ext = /png/i.test(photo.mime)
    ? "png"
    : /jpe?g/i.test(photo.mime)
      ? "jpg"
      : "webp";
  const path = `admin-personas/${input.personaId}/avatar-${Date.now()}.${ext}`;
  const { error: upErr } = await service.storage
    .from("chat-images")
    .upload(path, photo.bytes, {
      contentType: photo.mime,
      cacheControl: "31536000",
      upsert: false,
    });
  if (upErr) {
    return { ok: false, error: `Upload faalde: ${upErr.message}`, status: 500 };
  }
  const { data: pub } = service.storage.from("chat-images").getPublicUrl(path);
  if (!pub?.publicUrl) {
    return {
      ok: false,
      error: "Kon public URL niet bepalen voor avatar.",
      status: 500,
    };
  }

  const { error: updateErr } = await service
    .from("chat_profiles")
    .update({ avatar_url: pub.publicUrl })
    .eq("id", input.personaId);
  if (updateErr) {
    return {
      ok: false,
      error: `DB-update faalde: ${updateErr.message}`,
      status: 500,
    };
  }

  await recordAndConsumeSceneTemplateUse({
    service,
    personaId: input.personaId,
    slot: "avatar",
    template,
  });

  return {
    ok: true,
    avatar_url: pub.publicUrl,
    seed: photo.seed,
    backend: photo.backend,
  };
}

export type AppendGalleryInput = {
  personaId: string;
  variant?: number;
  scene?: string;
};

export type AppendGalleryResult =
  | {
      ok: true;
      gallery_url: string;
      gallery_urls: string[];
      seed: number;
      backend: string;
    }
  | { ok: false; error: string; status?: number };

/** Phase 3: render ONE gallery shot and append it to gallery_urls. */
export async function appendPersonaGalleryPhoto(
  service: SupabaseClient,
  input: AppendGalleryInput,
): Promise<AppendGalleryResult> {
  const { data: persona, error: loadErr } = await service
    .from("chat_profiles")
    .select("*")
    .eq("id", input.personaId)
    .maybeSingle();
  if (loadErr) return { ok: false, error: loadErr.message, status: 500 };
  if (!persona) return { ok: false, error: "Persona niet gevonden.", status: 404 };

  const galleryPool = await loadActiveTemplatesForSlot(service, "gallery");
  const picked = await pickFreshSceneTemplate({
    service,
    personaId: input.personaId,
    slot: "gallery",
    attempt: input.variant,
    fallbackVariant: input.variant,
    pool: galleryPool,
  });
  const template = picked.template;
  const scene = (input.scene ?? "").trim() || template.scene;

  const { prompt, seed: anchorSeed, negativePrompt } = buildPersonaPhotoPrompt({
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

  // Gallery shots use a per-variant seed offset so the diffusion noise
  // pattern actually differs between the photos. Same seed + same
  // appearance produces near-identical compositions even when scene/
  // outfit prompts differ.
  const variantOffset =
    typeof input.variant === "number" && Number.isFinite(input.variant)
      ? Math.floor(input.variant) * 7919 // prime so offsets don't align
      : Math.floor(Math.random() * 1_000_000);
  const seed = (anchorSeed + variantOffset) >>> 0;

  console.log("[persona-ops/append-gallery]", {
    persona: input.personaId,
    variant: input.variant,
    template: template.scene.slice(0, 60),
    seed,
    negPromptChars: negativePrompt.length,
  });

  const photo = await generatePersonaPhoto({ prompt, seed });
  if (!photo.ok) {
    return {
      ok: false,
      error: `Foto-generatie faalde: ${photo.error}`,
      status: 502,
    };
  }

  const ext = /png/i.test(photo.mime)
    ? "png"
    : /jpe?g/i.test(photo.mime)
      ? "jpg"
      : "webp";
  const path = `admin-personas/${input.personaId}/gallery-${Date.now()}-${
    Math.floor(Math.random() * 9999)
  }.${ext}`;
  const { error: upErr } = await service.storage
    .from("chat-images")
    .upload(path, photo.bytes, {
      contentType: photo.mime,
      cacheControl: "31536000",
      upsert: false,
    });
  if (upErr) {
    return { ok: false, error: `Upload faalde: ${upErr.message}`, status: 500 };
  }
  const { data: pub } = service.storage.from("chat-images").getPublicUrl(path);
  if (!pub?.publicUrl) {
    return {
      ok: false,
      error: "Kon public URL niet bepalen voor gallery-foto.",
      status: 500,
    };
  }

  const existing = Array.isArray(persona.gallery_urls)
    ? (persona.gallery_urls.filter(
        (u: unknown) => typeof u === "string" && u.length > 0,
      ) as string[])
    : [];
  const nextGallery = [...existing, pub.publicUrl];

  const { error: updateErr } = await service
    .from("chat_profiles")
    .update({ gallery_urls: nextGallery })
    .eq("id", input.personaId);
  if (updateErr) {
    return {
      ok: false,
      error: `DB-update faalde: ${updateErr.message}`,
      status: 500,
    };
  }

  await recordAndConsumeSceneTemplateUse({
    service,
    personaId: input.personaId,
    slot: "gallery",
    template,
  });

  return {
    ok: true,
    gallery_url: pub.publicUrl,
    gallery_urls: nextGallery,
    seed: photo.seed,
    backend: photo.backend,
  };
}

// ============================================================================
// NUDE GALLERY PHOTO GENERATION (dedicated explicit template pool)
// ============================================================================

export type AppendNudeGalleryInput = {
  personaId: string;
  variant?: number;
  /** Optional diversity hint to force different camera styles when generating
   * multiple nudes for the same persona in one session.
   * "mirror" | "low" | "high" | "close" | "side"
   */
  diversity?: "mirror" | "low" | "high" | "close" | "side";
};

export type AppendNudeGalleryResult =
  | { ok: true; gallery_url: string; gallery_urls: string[]; seed: number; backend: string }
  | { ok: false; error: string; status?: number };

/** Generate ONE explicit nude gallery photo using the dedicated nude template pool.
 *  This bypasses the normal scene template system and forces full explicit styling.
 */
export async function appendNudeGalleryPhoto(
  service: SupabaseClient,
  input: AppendNudeGalleryInput,
): Promise<AppendNudeGalleryResult> {
  const { data: persona, error: loadErr } = await service
    .from("chat_profiles")
    .select("*")
    .eq("id", input.personaId)
    .maybeSingle();

  if (loadErr) return { ok: false, error: loadErr.message, status: 500 };
  if (!persona) return { ok: false, error: "Persona niet gevonden.", status: 404 };

  // Prefer DB-managed nude templates (Grok-generated, admin-curated).
  // Fall back to in-code NUDE_TEMPLATES if the DB pool is empty.
  // When using a DB template we will consume (delete) it after successful render.
  let template: Parameters<typeof buildPersonaPhotoPrompt>[0]["cameraStyle"] & { scene: string };
  let consumedTemplateId: string | null = null; // for DB consumption
  const dbNude = await loadActiveNudeTemplates(service);

  // Explicit type to avoid complex (typeof dbNude)[number] inference issues
  // when dbNude can be null.
  type NudeTemplate = NonNullable<Awaited<ReturnType<typeof loadActiveNudeTemplates>>>[number];
  let pick: NudeTemplate | undefined;

  if (dbNude && dbNude.length > 0) {
    if (input.diversity) {
      // Try to find a template whose camera description matches the requested diversity
      const keywords: Record<string, string[]> = {
        mirror: ["mirror", "selfie", "reflection"],
        low: ["low", "below", "under", "between legs", "ground"],
        high: ["high", "above", "overhead", "looking down"],
        close: ["close", "extreme", "tight", "nipple", "detail"],
        side: ["side", "profile", "3/4", "over shoulder", "behind"],
      };
      const wanted = keywords[input.diversity] ?? [];
      pick = dbNude.find((t) =>
        wanted.some((k) => t.camera.toLowerCase().includes(k) || t.pose.toLowerCase().includes(k)),
      );
    }

    if (!pick) {
      pick = dbNude[Math.floor(Math.random() * dbNude.length)]!;
    }

    template = {
      scene: pick.scene,
      camera: pick.camera,
      backdrop: pick.backdrop,
      lighting: pick.lighting,
      capture: pick.capture,
      outfit: pick.outfit,
      pose: pick.pose,
    };
    consumedTemplateId = pick.id;
    console.log("[persona-ops/append-nude] using DB template", {
      pool: dbNude.length,
      diversity: input.diversity ?? "random",
      scene: pick.scene.slice(0, 60),
    });
  } else {
    const [picked] = pickFreshNudeTemplates(1, input.personaId);
    template = {
      scene: picked.scene,
      camera: picked.camera,
      backdrop: picked.backdrop,
      lighting: picked.lighting,
      capture: picked.capture,
      outfit: picked.outfit,
      pose: picked.pose,
    };
    console.log("[persona-ops/append-nude] using in-code fallback template");
  }

  // Reinforce explicit nude outfit on top of whatever the template specifies.
  // The Grok-generated nude templates already include nudity tokens, but
  // doubling them up guarantees nothing slips through clothed.
  const baseOutfit = (template.outfit ?? "").trim();
  const explicitOutfit = /naakt|nude|bare skin|no clothes|topless|breasts|vagina|pussy/i.test(baseOutfit)
    ? baseOutfit
    : "completely nude, no clothes at all, bare skin, full frontal nudity, breasts and vagina clearly visible, amateur self-taken";

  const { prompt, seed: anchorSeed, negativePrompt } = buildPersonaPhotoPrompt({
    profile: persona as Parameters<typeof buildPersonaPhotoPrompt>[0]["profile"],
    scene: template.scene,
    cameraStyle: {
      camera: template.camera,
      backdrop: template.backdrop,
      lighting: template.lighting,
      capture: template.capture,
      outfit: explicitOutfit,
      pose: template.pose,
    },
  });

  const variantOffset =
    typeof input.variant === "number" && Number.isFinite(input.variant)
      ? Math.floor(input.variant) * 7919
      : Math.floor(Math.random() * 1_000_000);

  const seed = (anchorSeed + variantOffset) >>> 0;

  console.log("[persona-ops/append-nude]", {
    persona: input.personaId,
    template: template.scene.slice(0, 70),
    seed,
  });

  const photo = await generatePersonaPhoto({ prompt, seed });
  if (!photo.ok) {
    return { ok: false, error: `Foto-generatie faalde: ${photo.error}`, status: 502 };
  }

  const ext = /png/i.test(photo.mime) ? "png" : /jpe?g/i.test(photo.mime) ? "jpg" : "webp";
  const path = `admin-personas/${input.personaId}/nude-${Date.now()}.${ext}`;

  const { error: upErr } = await service.storage
    .from("chat-images")
    .upload(path, photo.bytes, {
      contentType: photo.mime,
      cacheControl: "31536000",
      upsert: false,
    });

  if (upErr) {
    return { ok: false, error: `Upload faalde: ${upErr.message}`, status: 500 };
  }

  const { data: pub } = service.storage.from("chat-images").getPublicUrl(path);
  if (!pub?.publicUrl) {
    return { ok: false, error: "Kon public URL niet bepalen voor nude foto.", status: 500 };
  }

  const existing = Array.isArray(persona.gallery_urls)
    ? (persona.gallery_urls.filter((u: unknown) => typeof u === "string" && u.length > 0) as string[])
    : [];

  const nextGallery = [...existing, pub.publicUrl];

  const { error: updateErr } = await service
    .from("chat_profiles")
    .update({ gallery_urls: nextGallery })
    .eq("id", input.personaId);

  if (updateErr) {
    return { ok: false, error: `DB-update faalde: ${updateErr.message}`, status: 500 };
  }

  // Consume the DB template so it is never used again (single-use pool).
  if (consumedTemplateId) {
    try {
      await service.from("scene_templates").delete().eq("id", consumedTemplateId);
    } catch (e) {
      console.warn("[persona-ops/append-nude] failed to consume template", e);
    }
  }

  return {
    ok: true,
    gallery_url: pub.publicUrl,
    gallery_urls: nextGallery,
    seed: photo.seed,
    backend: photo.backend,
  };
}

