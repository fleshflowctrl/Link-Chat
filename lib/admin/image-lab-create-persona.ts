/**
 * Create a v2 chat_profiles row from Image Lab renders.
 *
 * Flow:
 *   1. Optional Grok vision pass on the first 1–2 photos → appearance hint.
 *   2. Grok persona JSON via generatePersonaFromBrief (v2 kink brief).
 *   3. Copy lab images into admin-personas/<id>/ and set avatar + gallery.
 *   4. Patch photo_style.seed from the avatar render for future consistency.
 */

import { randomInt } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { generatePersonaFromBrief } from "@/lib/admin/generate-persona";
import { parsePersonaPayload } from "@/lib/admin/persona-payload";
import {
  V2_PERSONA_BULK_BRIEF,
  defaultAttractivenessForVariant,
} from "@/lib/admin/v2-persona-config";
import { grokResponsesComplete } from "@/lib/xai/grok-responses";
import type { GrokContentPart } from "@/lib/xai/grok-responses";

const CHAT_IMAGES_BUCKET = "chat-images";

export type LabImageInput = {
  url: string;
  prompt: string;
  seed: number;
};

export type CreateV2PersonaFromLabInput = {
  images: LabImageInput[];
  /** Storage id of the image used as avatar (must be in `images`). */
  avatarUrl: string;
  /** Extra operator brief (kink prefs, city, age hint, etc.). */
  briefAddon?: string;
};

export type CreateV2PersonaFromLabResult =
  | {
      ok: true;
      personaId: string;
      displayName: string;
      avatarUrl: string;
      galleryUrls: string[];
      visionDescription: string | null;
    }
  | { ok: false; error: string; status?: number };

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

/** Describe the woman in the lab photos so Grok can write a matching profile. */
async function describeLabImages(imageUrls: string[]): Promise<string | null> {
  const urls = imageUrls.filter((u) => /^https?:\/\//i.test(u)).slice(0, 2);
  if (urls.length === 0) return null;

  const parts: GrokContentPart[] = [
    {
      type: "text",
      text: `Je ziet ${urls.length === 1 ? "één" : "twee"} referentiefoto('s) van een vrouw voor een Nederlandse fetish/kink dating-app (v2).

Beschrijf haar in het Nederlands, max 120 woorden, concreet:
- geschatte leeftijd (getal)
- haar, ogen, huid, gezichtsvorm
- lichaamsbouw (slim / gemiddeld / plus)
- wat ze draagt / pose / setting op de foto
- algemene vibe (dominant, speels, zelfverzekerd, etc.)

Geen pornografische grafische taal. Geen markdown. Alleen de beschrijving.`,
    },
    ...urls.map(
      (url): GrokContentPart => ({
        type: "image_url",
        image_url: { url, detail: "high" },
      }),
    ),
  ];

  const res = await grokResponsesComplete(
    [{ role: "user", content: parts }],
    { temperature: 0.4, maxOutputTokens: 400 },
  );
  if (!res.ok) return null;
  const text = res.text.trim();
  return text.length > 0 ? text.slice(0, 800) : null;
}

async function copyImageToPersonaFolder(
  service: SupabaseClient,
  sourceUrl: string,
  personaId: string,
  slot: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) {
      return { ok: false, error: `Download HTTP ${res.status}` };
    }
    const bytes = Buffer.from(await res.arrayBuffer());
    const mime = res.headers.get("content-type") || "image/jpeg";
    const ext = /png/i.test(mime) ? "png" : /webp/i.test(mime) ? "webp" : "jpg";
    const path = `admin-personas/${personaId}/${slot}.${ext}`;

    const { error: upErr } = await service.storage
      .from(CHAT_IMAGES_BUCKET)
      .upload(path, bytes, {
        contentType: mime,
        cacheControl: "31536000",
        upsert: true,
      });
    if (upErr) return { ok: false, error: upErr.message };

    const { data } = service.storage.from(CHAT_IMAGES_BUCKET).getPublicUrl(path);
    if (!data?.publicUrl) {
      return { ok: false, error: "Kon public URL niet bepalen." };
    }
    return { ok: true, url: data.publicUrl };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function createV2PersonaFromLabImages(
  service: SupabaseClient,
  input: CreateV2PersonaFromLabInput,
): Promise<CreateV2PersonaFromLabResult> {
  const images = input.images.filter((i) => i.url.trim().length > 0);
  if (images.length === 0) {
    return { ok: false, error: "Geen afbeeldingen geselecteerd.", status: 400 };
  }
  if (images.length > 8) {
    return { ok: false, error: "Maximaal 8 foto's per persona.", status: 400 };
  }

  const avatarInput =
    images.find((i) => i.url === input.avatarUrl) ?? images[0]!;
  const galleryInputs = images.filter((i) => i.url !== avatarInput.url);

  const visionDescription = await describeLabImages(
    images.map((i) => i.url),
  );

  const promptSummary = images
    .map((i, idx) => `Foto ${idx + 1}: ${i.prompt.slice(0, 280)}`)
    .join("\n");

  const forcedAge = 22 + Math.floor(Math.random() * 19); // 22–40 for v2 lab
  const attractiveness = defaultAttractivenessForVariant("v2");

  const briefParts = [
    V2_PERSONA_BULK_BRIEF,
    input.briefAddon?.trim(),
    `BELANGRIJK: Deze persona moet visueel matchen bij de referentiefoto's in de image-lab.`,
    visionDescription
      ? `Visuele beschrijving van de referentiefoto's (gebruik dit letterlijk in photo_style.appearance en build):\n${visionDescription}`
      : null,
    `Image-gen prompts van de geselecteerde foto's:\n${promptSummary}`,
    `Maak een kinky, sexy, zelfverzekerde NL-persona. Bio open over kink/voorkeuren maar niet grafisch pornografisch.`,
  ].filter(Boolean);

  const generated = await generatePersonaFromBrief({
    brief: briefParts.join("\n\n"),
    index: 0,
    total: 1,
    attractiveness,
    body_type: "average",
    forced_age: forcedAge,
    appVariant: "v2",
  });

  if (!generated.ok) {
    return {
      ok: false,
      error: `Grok persona-generatie faalde: ${generated.error}`,
      status: 502,
    };
  }

  const uniqueId = await resolveUniqueId(service, generated.persona.id);

  generated.persona.photo_style.seed = avatarInput.seed || randomInt(100_000, 999_999_999);
  generated.persona.photo_style.attractiveness = attractiveness;
  if (visionDescription) {
    const appearance = visionDescription.slice(0, 400);
    generated.persona.photo_style.appearance = appearance;
  }
  if (!generated.persona.photo_style.style.trim()) {
    generated.persona.photo_style.style =
      "completely nude amateur self-taken, mirror or bedroom, bare skin, full frontal";
  }
  if (!generated.persona.photo_style.vibe.trim()) {
    generated.persona.photo_style.vibe =
      "rauw en intiem, slecht belicht, late-night amateur nude selfie, geen studio";
  }

  const copiedAvatar = await copyImageToPersonaFolder(
    service,
    avatarInput.url,
    uniqueId,
    "avatar-from-lab",
  );
  if (!copiedAvatar.ok) {
    return { ok: false, error: copiedAvatar.error, status: 500 };
  }

  const galleryUrls: string[] = [];
  for (let i = 0; i < galleryInputs.length; i++) {
    const img = galleryInputs[i]!;
    const copied = await copyImageToPersonaFolder(
      service,
      img.url,
      uniqueId,
      `gallery-from-lab-${i + 1}`,
    );
    if (copied.ok) galleryUrls.push(copied.url);
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
    avatar_url: copiedAvatar.url,
    gallery_urls: galleryUrls,
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
    app_variant: "v2" as const,
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
    personaId: parsed.row.id,
    displayName: parsed.row.display_name,
    avatarUrl: copiedAvatar.url,
    galleryUrls,
    visionDescription,
  };
}
