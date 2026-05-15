import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { parsePersonaPayload } from "@/lib/admin/persona-payload";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
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

  // select("*") tolerates partial migrations — missing columns just
  // come back undefined instead of failing the whole query.
  const { data, error } = await service
    .from("chat_profiles")
    .select("*")
    .order("home_sort", { ascending: true })
    .order("display_name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ personas: data ?? [] });
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

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON." }, { status: 400 });
  }

  const parsed = parsePersonaPayload(payload, { mode: "create" });
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { data: existing } = await service
    .from("chat_profiles")
    .select("id")
    .eq("id", parsed.row.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: `Persona '${parsed.row.id}' bestaat al — kies een andere ID.` },
      { status: 409 },
    );
  }

  const { error: insertError } = await service.from("chat_profiles").insert(parsed.row);
  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: parsed.row.id }, { status: 201 });
}
