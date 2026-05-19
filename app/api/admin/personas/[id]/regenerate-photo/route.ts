import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import {
  regeneratePersonaAvatar,
  regeneratePersonaNudeAvatar,
} from "@/lib/admin/persona-ops";
import { v2NudeDiversityForVariant } from "@/lib/admin/v2-persona-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Phase 2 of auto-generate: produce the actual Z-Image-Turbo portrait
 * for a persona and swap her avatar_url. Shared core logic lives in
 * `lib/admin/persona-ops.ts` so the background batch worker uses the
 * same code path.
 *
 * 60s is the maximum on Vercel Pro and the largest practical budget for
 * a single image generation. If the Space is still cold past that, we
 * surface a 504-ish error to the client which keeps the existing
 * placeholder avatar; the operator can retry from the persona's edit
 * page. */
export const maxDuration = 60;

type RouteCtx = { params: { id: string } };

type RegenerateBody = {
  scene?: string;
  slot?: "avatar" | "gallery";
  variant?: number;
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

  let body: RegenerateBody = {};
  try {
    if (req.headers.get("content-length") !== "0") {
      body = (await req.json()) as RegenerateBody;
    }
  } catch {
    // Empty / malformed body is fine — we have a default template.
  }

  const { data: profile } = await service
    .from("chat_profiles")
    .select("app_variant")
    .eq("id", ctx.params.id)
    .maybeSingle();

  const variantIndex =
    typeof body.variant === "number" && Number.isFinite(body.variant)
      ? Math.floor(body.variant)
      : 0;

  const result =
    profile?.app_variant === "v2"
      ? await regeneratePersonaNudeAvatar(service, {
          personaId: ctx.params.id,
          variant: variantIndex,
          diversity: v2NudeDiversityForVariant(variantIndex),
        })
      : await regeneratePersonaAvatar(service, {
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
    avatar_url: result.avatar_url,
    seed: result.seed,
    backend: result.backend,
  });
}
