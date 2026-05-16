import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { parsePersonaPayload } from "@/lib/admin/persona-payload";
import { purgePersonaStorage } from "@/lib/admin/persona-delete";

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

/**
 * DELETE /api/admin/personas/[id]?mode=archive|restore|hard
 *
 *   archive (default) — sets `is_archived = true`. Persona disappears from
 *                       discovery and home. All data is kept. Reversible.
 *   restore           — clears `is_archived`. Brings the persona back.
 *   hard              — permanent delete. Cascades through chat_messages,
 *                       chat_ai_thread_memory, chat_pending_replies,
 *                       ai_chat_turn_logs (FK on delete cascade) and nukes
 *                       persona-owned photos from storage. Not reversible.
 */
export async function DELETE(req: Request, ctx: RouteCtx) {
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

  const url = new URL(req.url);
  const modeRaw = (url.searchParams.get("mode") ?? "archive").toLowerCase();
  const mode: "archive" | "restore" | "hard" =
    modeRaw === "hard" ? "hard" : modeRaw === "restore" ? "restore" : "archive";

  if (mode === "archive") {
    const { error } = await service
      .from("chat_profiles")
      .update({ is_archived: true })
      .eq("id", ctx.params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, mode });
  }

  if (mode === "restore") {
    const { error } = await service
      .from("chat_profiles")
      .update({ is_archived: false })
      .eq("id", ctx.params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, mode });
  }

  // mode === "hard"
  // Best-effort: clean up storage first (so we don't end up with orphan
  // files if the row is deleted but storage list fails). Storage failures
  // are logged but don't block the row delete — admin would prefer the
  // persona gone over a perfect filesystem.
  const purge = await purgePersonaStorage(service, ctx.params.id);

  const { error } = await service
    .from("chat_profiles")
    .delete()
    .eq("id", ctx.params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    mode,
    storage: { removed: purge.removed, errors: purge.errors },
  });
}
