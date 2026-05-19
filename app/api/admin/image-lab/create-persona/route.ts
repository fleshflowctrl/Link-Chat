import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createV2PersonaFromLabImages } from "@/lib/admin/image-lab-create-persona";
import { getServiceSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

type Body = {
  images?: Array<{ url?: string; prompt?: string; seed?: number }>;
  avatarUrl?: string;
  briefAddon?: string;
};

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

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON." }, { status: 400 });
  }

  const rawImages = Array.isArray(body.images) ? body.images : [];
  const images = rawImages
    .filter((i) => typeof i?.url === "string" && i.url.trim().length > 0)
    .map((i) => ({
      url: i.url!.trim(),
      prompt: typeof i.prompt === "string" ? i.prompt : "",
      seed: typeof i.seed === "number" && Number.isFinite(i.seed) ? i.seed : 0,
    }));

  if (images.length === 0) {
    return NextResponse.json(
      { error: "Selecteer minstens één afbeelding." },
      { status: 400 },
    );
  }

  const avatarUrl =
    typeof body.avatarUrl === "string" && body.avatarUrl.trim()
      ? body.avatarUrl.trim()
      : images[0]!.url;

  const briefAddon =
    typeof body.briefAddon === "string" ? body.briefAddon.trim() : "";

  const result = await createV2PersonaFromLabImages(service, {
    images,
    avatarUrl,
    briefAddon: briefAddon || undefined,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status ?? 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    personaId: result.personaId,
    displayName: result.displayName,
    avatarUrl: result.avatarUrl,
    galleryUrls: result.galleryUrls,
    visionDescription: result.visionDescription,
    editUrl: `/admin/personas/${result.personaId}/edit`,
  });
}
