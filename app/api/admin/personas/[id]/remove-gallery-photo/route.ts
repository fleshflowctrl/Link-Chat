import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/personas/[id]/remove-gallery-photo
 * Body: { url: string }
 *
 * Removes a single photo URL from the persona's gallery_urls array.
 * Very simple and safe — used by the dedicated Nudes admin page.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const service = getServiceSupabase();
  if (!service) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY ontbreekt." }, { status: 500 });
  }

  const personaId = params.id;

  let body: { url?: string };
  try {
    body = (await req.json()) as { url?: string };
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON" }, { status: 400 });
  }

  const urlToRemove = body.url?.trim();
  if (!urlToRemove) {
    return NextResponse.json({ error: "url is verplicht" }, { status: 400 });
  }

  // Load current gallery
  const { data: row, error: loadErr } = await service
    .from("chat_profiles")
    .select("gallery_urls")
    .eq("id", personaId)
    .maybeSingle();

  if (loadErr) {
    return NextResponse.json({ error: loadErr.message }, { status: 500 });
  }

  const current = Array.isArray((row as any)?.gallery_urls)
    ? ((row as any).gallery_urls as string[])
    : [];

  const filtered = current.filter((u) => u !== urlToRemove);

  if (filtered.length === current.length) {
    // Nothing changed — URL wasn't in the list
    return NextResponse.json({ ok: true, removed: false, gallery_urls: current });
  }

  const { error: updateErr } = await service
    .from("chat_profiles")
    .update({ gallery_urls: filtered })
    .eq("id", personaId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, removed: true, gallery_urls: filtered });
}
