import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { parsePersonaPayload } from "@/lib/admin/persona-payload";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteCtx = { params: { id: string } };

export async function GET(_req: Request, ctx: RouteCtx) {
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

  const { data, error } = await service
    .from("chat_profiles")
    .select("*")
    .eq("id", ctx.params.id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Persona niet gevonden." }, { status: 404 });
  }
  return NextResponse.json({ persona: data });
}

export async function PATCH(req: Request, ctx: RouteCtx) {
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

  const { data: existing, error: fetchErr } = await service
    .from("chat_profiles")
    .select("*")
    .eq("id", ctx.params.id)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: "Persona niet gevonden." }, { status: 404 });

  // Force the URL `id` to win over any body field — admins shouldn't be able
  // to rename a persona via PATCH (would orphan all FKs).
  const incoming = { ...(payload as Record<string, unknown>), id: ctx.params.id };

  const parsed = parsePersonaPayload(incoming, {
    mode: "update",
    existing: existing as Partial<Parameters<typeof parsePersonaPayload>[0] & object>,
  });
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { error: updateErr } = await service
    .from("chat_profiles")
    .update(parsed.row)
    .eq("id", ctx.params.id);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: ctx.params.id });
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
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

  // Soft-delete by archiving — chat_messages keeps FK and we never lose
  // history. A future "hard delete" route can do the cascade.
  const { error } = await service
    .from("chat_profiles")
    .update({ is_archived: true })
    .eq("id", ctx.params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
