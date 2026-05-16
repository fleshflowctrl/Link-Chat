import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { createPersonaFromBrief } from "@/lib/admin/persona-ops";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
/** Phase 1 of auto-generate: Grok writes the profile + we upload an
 * initials placeholder avatar + we insert into chat_profiles. The actual
 * work lives in `lib/admin/persona-ops.ts` so the new background batch
 * worker (`/api/admin/personas/batch/tick`) shares the same code path.
 *
 * Why 60s: a single Grok turn is usually 5-15s, but when xAI is under
 * load + we hit the JSON-repair retry path (~+15s) + a cold-start eats
 * 5s, anything tighter would 504. */
export const maxDuration = 60;

type GenerateBody = {
  brief?: string;
  index?: number;
  total?: number;
  exclude?: string[];
  attractiveness?: "striking" | "average" | "plain";
  body_type?: "slim" | "average" | "plus";
  age_min?: number;
  age_max?: number;
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
  const exclude = Array.isArray(body.exclude)
    ? body.exclude.slice(0, 12).map(String)
    : [];
  const attractiveness =
    body.attractiveness === "striking" || body.attractiveness === "plain"
      ? body.attractiveness
      : "average";
  const bodyType =
    body.body_type === "slim" || body.body_type === "plus"
      ? body.body_type
      : "average";

  const rawMin = Number(body.age_min);
  const rawMax = Number(body.age_max);
  const age_min = Number.isFinite(rawMin) ? rawMin : 22;
  const age_max = Number.isFinite(rawMax) ? rawMax : 30;

  const result = await createPersonaFromBrief(service, {
    brief,
    index,
    total,
    exclude,
    attractiveness,
    body_type: bodyType,
    age_min,
    age_max,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status ?? 500 },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      persona: result.persona,
      warning: result.warning,
    },
    { status: 201 },
  );
}
