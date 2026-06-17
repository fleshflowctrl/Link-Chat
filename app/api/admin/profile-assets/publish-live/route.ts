import { NextResponse } from "next/server";
import {
  isProfileAssetVariant,
  publishPersonaToLive,
  unpublishPersonaFromLive,
} from "@/lib/admin/profile-assets";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  action?: "publish" | "unpublish";
  variant?: string;
  personaId?: string;
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

  const action = body.action === "unpublish" ? "unpublish" : "publish";
  const personaId = body.personaId?.trim() ?? "";
  const variantRaw = body.variant?.trim() ?? "";

  if (!personaId) {
    return NextResponse.json({ error: "personaId ontbreekt." }, { status: 400 });
  }
  if (!isProfileAssetVariant(variantRaw)) {
    return NextResponse.json({ error: "variant moet v1 of v2 zijn." }, { status: 400 });
  }

  try {
    if (action === "unpublish") {
      await unpublishPersonaFromLive(service, personaId, variantRaw);
      return NextResponse.json({ ok: true, personaId, online_now: false });
    }

    const result = await publishPersonaToLive(service, {
      variant: variantRaw,
      personaId,
    });

    return NextResponse.json({
      ok: true,
      personaId,
      online_now: true,
      liveUrl: result.liveUrl,
      livePath: result.livePath,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
