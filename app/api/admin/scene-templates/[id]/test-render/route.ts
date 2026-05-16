import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { generatePersonaPhoto } from "@/lib/images/generate-photo";
import { buildPersonaPhotoPrompt } from "@/lib/images/persona-photo-prompt";
import { SCENE_TEMPLATES_TABLE } from "@/lib/admin/scene-templates-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// One render call against the HF Space can take 20-50s.
export const maxDuration = 60;

type RouteCtx = { params: { id: string } };

type Preset =
  | "young-slim-striking"
  | "young-average"
  | "young-plus-average"
  | "mid-average"
  | "mid-plus-average"
  | "senior-average"
  | "senior-plus";

const PRESETS: Record<
  Preset,
  {
    age: number;
    attractiveness: "striking" | "average" | "plain";
    body_type: "slim" | "average" | "plus";
    label: string;
  }
> = {
  "young-slim-striking": {
    age: 24,
    attractiveness: "striking",
    body_type: "slim",
    label: "24j, slank, striking",
  },
  "young-average": {
    age: 26,
    attractiveness: "average",
    body_type: "average",
    label: "26j, gemiddeld, average",
  },
  "young-plus-average": {
    age: 27,
    attractiveness: "average",
    body_type: "plus",
    label: "27j, plus, average",
  },
  "mid-average": {
    age: 38,
    attractiveness: "average",
    body_type: "average",
    label: "38j, gemiddeld, average",
  },
  "mid-plus-average": {
    age: 42,
    attractiveness: "average",
    body_type: "plus",
    label: "42j, plus, average",
  },
  "senior-average": {
    age: 58,
    attractiveness: "average",
    body_type: "average",
    label: "58j, gemiddeld, average",
  },
  "senior-plus": {
    age: 65,
    attractiveness: "average",
    body_type: "plus",
    label: "65j, plus, average",
  },
};

type Body = {
  preset?: Preset;
  /** Optional persona id to use as the test subject instead of a
   * synthetic preset. When provided we load the row from chat_profiles
   * and render the template against that persona's own appearance
   * anchors — exactly what would happen in production. */
  personaId?: string;
};

function isPreset(v: unknown): v is Preset {
  return typeof v === "string" && v in PRESETS;
}

export async function POST(req: Request, ctx: RouteCtx) {
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

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON." }, { status: 400 });
  }

  const id = ctx.params.id;
  if (!id) {
    return NextResponse.json({ error: "id ontbreekt." }, { status: 400 });
  }

  // 1. Load the template from the DB.
  const { data: tplRow, error: tplErr } = await service
    .from(SCENE_TEMPLATES_TABLE)
    .select("scene, camera, backdrop, lighting, capture, outfit, pose, kind, template_id")
    .eq("id", id)
    .maybeSingle();
  if (tplErr) {
    return NextResponse.json({ error: tplErr.message }, { status: 500 });
  }
  if (!tplRow) {
    return NextResponse.json({ error: "Template niet gevonden." }, { status: 404 });
  }
  const template = tplRow as {
    scene: string;
    camera: string;
    backdrop: string;
    lighting: string;
    capture: string;
    outfit: string;
    pose: string;
    kind: "avatar" | "gallery" | "mixed";
    template_id: string;
  };

  // 2. Determine the test subject. Either an existing persona row, or
  //    a synthetic preset that mimics what the persona-creator would
  //    produce for the chosen age/body/attractiveness tier.
  let testProfile: Parameters<typeof buildPersonaPhotoPrompt>[0]["profile"];
  let subjectLabel: string;

  if (body.personaId && typeof body.personaId === "string") {
    const { data: persona, error: pErr } = await service
      .from("chat_profiles")
      .select("*")
      .eq("id", body.personaId)
      .maybeSingle();
    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }
    if (!persona) {
      return NextResponse.json(
        { error: "Persona niet gevonden." },
        { status: 404 },
      );
    }
    testProfile = persona as Parameters<typeof buildPersonaPhotoPrompt>[0]["profile"];
    const r = persona as { display_name?: string; age?: number };
    subjectLabel = `${r.display_name ?? "persona"} (${r.age ?? "?"})`;
  } else {
    const preset = isPreset(body.preset) ? body.preset : "mid-average";
    const ps = PRESETS[preset];
    // Synthetic profile good enough for buildPersonaPhotoPrompt — the
    // prompt builder only reads `id`, `age`, and `photo_style.*`. We
    // mint a deterministic id per (template, preset) so the identity
    // anchor (derivePersonaIdentity) is stable across re-renders, but
    // different per (template, preset) combo so two templates rendered
    // with the same preset don't collapse onto the same face.
    const stableId = `test-${template.template_id}-${preset}`;
    testProfile = {
      id: stableId,
      age: ps.age,
      photo_style: {
        attractiveness: ps.attractiveness,
        body_type: ps.body_type,
      },
    } as unknown as Parameters<typeof buildPersonaPhotoPrompt>[0]["profile"];
    subjectLabel = ps.label;
  }

  // 3. Build the prompt + render.
  const { prompt, seed, negativePrompt } = buildPersonaPhotoPrompt({
    profile: testProfile,
    scene: template.scene,
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
    return NextResponse.json(
      {
        ok: false,
        error: `Foto-generatie faalde: ${photo.error}`,
      },
      { status: 502 },
    );
  }

  // 4. Upload under a dedicated /scene-template-tests/ prefix so the
  //    operator can clean these up later without touching real persona
  //    folders. Path includes template id so spam-clicking re-render
  //    produces fresh paths (otherwise the upload would 409 on dup).
  const ext = /png/i.test(photo.mime)
    ? "png"
    : /jpe?g/i.test(photo.mime)
      ? "jpg"
      : "webp";
  const path = `scene-template-tests/${template.template_id}/test-${Date.now()}.${ext}`;

  const { error: uploadErr } = await service.storage
    .from("chat-images")
    .upload(path, photo.bytes, {
      contentType: photo.mime,
      cacheControl: "3600",
      upsert: false,
    });
  if (uploadErr) {
    return NextResponse.json(
      { error: `Upload faalde: ${uploadErr.message}` },
      { status: 500 },
    );
  }
  const { data: pub } = service.storage.from("chat-images").getPublicUrl(path);
  if (!pub?.publicUrl) {
    return NextResponse.json(
      { error: "Kon public URL niet bepalen." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    url: pub.publicUrl,
    seed: photo.seed,
    backend: photo.backend,
    subject: subjectLabel,
    promptPreview: prompt.slice(0, 400),
    negPromptChars: negativePrompt.length,
  });
}
