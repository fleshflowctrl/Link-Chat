import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/personas/[id]/set-avatar
 * Body: { url: string }
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
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

  let body: { url?: string };
  try {
    body = (await req.json()) as { url?: string };
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON" }, { status: 400 });
  }

  const url = body.url?.trim() ?? "";
  if (url.length > 0 && !/^https?:\/\//.test(url)) {
    return NextResponse.json({ error: "Geldige https-URL vereist" }, { status: 400 });
  }

  const { data: row, error: loadErr } = await service
    .from("chat_profiles")
    .select("id")
    .eq("id", params.id)
    .maybeSingle();

  if (loadErr) {
    return NextResponse.json({ error: loadErr.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "Persona niet gevonden." }, { status: 404 });
  }

  const { error: updateErr } = await service
    .from("chat_profiles")
    .update({
      avatar_url: url,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, avatar_url: url });
}
