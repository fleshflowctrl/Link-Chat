import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { appendPersonaGalleryPhoto, appendNudeGalleryPhoto } from "@/lib/admin/persona-ops";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Phase 3 of auto-generate: produce ONE additional gallery photo and
 * append the URL to the persona's `gallery_urls` array. Shared logic in
 * `lib/admin/persona-ops.ts` so the background batch worker uses the
 * same code path. */
export const maxDuration = 60;

type RouteCtx = { params: { id: string } };

type AppendBody = {
  variant?: number;
  scene?: string;
  /** When true, uses the dedicated nude template pool instead of normal scenes */
  nude?: boolean;
};

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

  let body: AppendBody = {};
  try {
    if (req.headers.get("content-length") !== "0") {
      body = (await req.json()) as AppendBody;
    }
  } catch {
    // empty / malformed body is fine — we have a default template
  }

  const result = body.nude
    ? await appendNudeGalleryPhoto(service, {
        personaId: ctx.params.id,
        variant: body.variant,
      })
    : await appendPersonaGalleryPhoto(service, {
        personaId: ctx.params.id,
        variant: body.variant,
        scene: body.scene,
      });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status ?? 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    gallery_url: result.gallery_url,
    gallery_urls: result.gallery_urls,
    seed: result.seed,
    backend: result.backend,
  });
}
