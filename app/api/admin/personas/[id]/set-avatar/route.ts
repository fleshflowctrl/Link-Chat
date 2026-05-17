import { NextResponse } from "next/server";
import { swapPersonaAvatarWithGallery } from "@/lib/admin/swap-persona-avatar-gallery";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function asGalleryUrls(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((u): u is string => typeof u === "string" && u.length > 0);
}

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
    .select("id, avatar_url, gallery_urls")
    .eq("id", params.id)
    .maybeSingle();

  if (loadErr) {
    return NextResponse.json({ error: loadErr.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "Persona niet gevonden." }, { status: 404 });
  }

  const previousAvatar =
    typeof (row as { avatar_url?: unknown }).avatar_url === "string"
      ? (row as { avatar_url: string }).avatar_url
      : "";
  const gallery = asGalleryUrls((row as { gallery_urls?: unknown }).gallery_urls);

  const next = swapPersonaAvatarWithGallery(previousAvatar, gallery, url);

  const { error: updateErr } = await service
    .from("chat_profiles")
    .update({
      avatar_url: next.avatar_url,
      gallery_urls: next.gallery_urls,
    })
    .eq("id", params.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    avatar_url: next.avatar_url,
    gallery_urls: next.gallery_urls,
  });
}
