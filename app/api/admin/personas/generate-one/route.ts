import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { parsePersonaPayload } from "@/lib/admin/persona-payload";
import { generatePersonaFromBrief } from "@/lib/admin/generate-persona";
import { uploadFallbackAvatar } from "@/lib/admin/fallback-avatar";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Phase 1 of auto-generate: Grok writes the profile + we upload an
 * initials placeholder avatar + we insert into chat_profiles. No
 * Z-Image-Turbo here — that lives in the dedicated regenerate-photo
 * endpoint, called per-persona by the client after this phase succeeds.
 *
 * Splitting matters because Vercel caps function duration. Z-Image-Turbo
 * cold-starts on Hugging Face Spaces can run 60-90s on their own,
 * blowing the 60s function budget when combined with Grok + DB writes
 * (which is what produced the 504 errors the operator was seeing).
 *
 * Why 60 here instead of 30: a single Grok turn is usually 5-15s, but
 * when xAI is under load + we hit the JSON-repair retry path (~+15s)
 * + a cold-start eats 5s, the original 30s budget would 504 even
 * though the call would have succeeded with another few seconds. */
export const maxDuration = 60;

type GenerateBody = {
  brief?: string;
  index?: number;
  total?: number;
  /** ids/names already produced in this batch — Grok is asked to pick
   * something different so a single batch yields varied personas. */
  exclude?: string[];
  /** Visual attractiveness tier — propagates to Grok's persona text and
   * to the photo prompt. Default "average" so a fresh discovery feed
   * doesn't feel like a model agency catalog. */
  attractiveness?: "striking" | "average" | "plain";
  /** Body shape tier. Default "average". Composes independently of
   * attractiveness (slim+plain, plus+striking, etc. are all valid). */
  body_type?: "slim" | "average" | "plus";
  /** Inclusive age range. The server picks a random age in [min, max]
   * for this persona before calling Grok and forces it post-coerce so
   * the operator's range is respected exactly. */
  age_min?: number;
  age_max?: number;
};

/** Resolve a slug that doesn't collide with an existing chat_profiles row.
 * Suffixes -2, -3, ... up to -9 if needed; if all are taken we hash a
 * short random tail so the operator at least gets a usable id. */
async function resolveUniqueId(
  service: ReturnType<typeof getServiceSupabase>,
  proposed: string,
): Promise<string> {
  if (!service) return proposed;
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

  let body: GenerateBody;
  try {
    body = (await req.json()) as GenerateBody;
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON." }, { status: 400 });
  }

  const brief = (body.brief ?? "").trim();
  if (!brief || brief.length < 6) {
    return NextResponse.json(
      { error: "Brief is te kort — beschrijf het type persona in 1-3 zinnen." },
      { status: 400 },
    );
  }
  const index = Number.isFinite(body.index) ? Number(body.index) : 0;
  const total = Math.max(1, Math.min(20, Number(body.total) || 1));
  const exclude = Array.isArray(body.exclude) ? body.exclude.slice(0, 12).map(String) : [];
  const attractiveness =
    body.attractiveness === "striking" || body.attractiveness === "plain"
      ? body.attractiveness
      : "average";
  const bodyType =
    body.body_type === "slim" || body.body_type === "plus"
      ? body.body_type
      : "average";

  // Age range — both bounds must be valid + ordered. We clamp to [18,99]
  // and pick a uniform-random age per persona; this gives the batch
  // visible age variety without needing client coordination.
  let forcedAge: number | undefined;
  const rawMin = Number(body.age_min);
  const rawMax = Number(body.age_max);
  if (Number.isFinite(rawMin) && Number.isFinite(rawMax)) {
    const lo = Math.max(18, Math.min(99, Math.round(Math.min(rawMin, rawMax))));
    const hi = Math.max(18, Math.min(99, Math.round(Math.max(rawMin, rawMax))));
    forcedAge = lo + Math.floor(Math.random() * (hi - lo + 1));
  }

  // 1) Generate the persona text/JSON via Grok.
  const generated = await generatePersonaFromBrief({
    brief,
    index,
    total,
    exclude,
    attractiveness,
    body_type: bodyType,
    forced_age: forcedAge,
  });
  if (!generated.ok) {
    return NextResponse.json(
      { error: `Generatie faalde: ${generated.error}` },
      { status: 502 },
    );
  }

  // 2) Resolve a unique slug.
  const uniqueId = await resolveUniqueId(service, generated.persona.id);

  // 3) Upload the initials placeholder avatar so the validator's required
  //    avatar_url is satisfied. Z-Image-Turbo replaces this in phase 2.
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
      return NextResponse.json(
        { error: `Avatar-upload faalde: ${fallback.error}` },
        { status: 500 },
      );
    }
  }

  // 4) Validate + insert.
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
    return NextResponse.json(
      { error: `Validatie faalde: ${parsed.error}`, generated: generated.persona },
      { status: 422 },
    );
  }

  const { error: insertError } = await service.from("chat_profiles").insert(parsed.row);
  if (insertError) {
    return NextResponse.json(
      { error: `Insert faalde: ${insertError.message}`, generated: generated.persona },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
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
    },
    { status: 201 },
  );
}
