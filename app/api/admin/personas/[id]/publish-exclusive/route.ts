import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  urls?: string[];
};

export async function POST(req: Request, { params }: { params: { id: string } }) {
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

  const personaId = params.id;
  if (!personaId) {
    return NextResponse.json({ error: "Persona id ontbreekt" }, { status: 400 });
  }

  let body: Body = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON" }, { status: 400 });
  }

  const urls = Array.isArray(body.urls)
    ? body.urls.filter((u): u is string => typeof u === "string" && u.length > 0)
    : [];

  if (urls.length === 0) {
    return NextResponse.json({ error: "Geen URLs opgegeven" }, { status: 400 });
  }

  // Load current exclusive_urls
  const { data: persona, error: loadErr } = await service
    .from("chat_profiles")
    .select("exclusive_urls")
    .eq("id", personaId)
    .maybeSingle();

  if (loadErr || !persona) {
    return NextResponse.json({ error: "Persona niet gevonden" }, { status: 404 });
  }

  const current = Array.isArray((persona as any).exclusive_urls)
    ? ((persona as any).exclusive_urls as string[])
    : [];

  // Deduplicate
  const next = Array.from(new Set([...current, ...urls]));

  const { error: updateErr } = await service
    .from("chat_profiles")
    .update({ exclusive_urls: next })
    .eq("id", personaId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, exclusive_urls: next });
}
