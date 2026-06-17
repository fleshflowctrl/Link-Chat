import { NextResponse } from "next/server";
import {
  fetchLiveMapProfiles,
  fetchPersonasForPicker,
  isProfileAssetVariant,
  liveProfilesFolder,
  syncLiveMapState,
} from "@/lib/admin/profile-assets";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
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

  const variant = new URL(req.url).searchParams.get("variant") ?? "v2";
  if (!isProfileAssetVariant(variant)) {
    return NextResponse.json({ error: "variant moet v1 of v2 zijn." }, { status: 400 });
  }

  try {
    await syncLiveMapState(service, variant);
    const [liveProfiles, allProfiles] = await Promise.all([
      fetchLiveMapProfiles(service, variant),
      fetchPersonasForPicker(service, variant),
    ]);

    return NextResponse.json({
      ok: true,
      variant,
      liveMapFolderPath: liveProfilesFolder(variant),
      liveProfiles,
      allProfiles,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
