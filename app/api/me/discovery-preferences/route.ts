import { NextResponse } from "next/server";
import type { DiscoveryPreferencesV1 } from "@/lib/discovery-preferences";
import {
  discoveryPrefsToJson,
  parseDiscoveryPreferencesJson,
  resolveDiscoveryPreferences,
} from "@/lib/discovery-preferences-server";
import { createClient } from "@/utils/supabase/server";
import { isSupabaseConfigured } from "@/utils/supabase/public-env";

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, prefs: null, anonymous: true });
  }

  let supabase: ReturnType<typeof createClient>;
  try {
    supabase = createClient();
  } catch {
    return bad("Server verkeerd geconfigureerd", 503);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: true, prefs: null, anonymous: true });
  }

  const { data: row, error } = await supabase
    .from("user_profiles")
    .select(
      "discovery_prefs, gender, seeking_gender, age_range_min, age_range_max, age_range_any, looking_for, interests",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[GET /api/me/discovery-preferences]", error);
    return bad("Voorkeuren laden mislukt", 500);
  }

  const prefs = resolveDiscoveryPreferences(row ?? undefined);
  return NextResponse.json({ ok: true, prefs, anonymous: false });
}

export async function PATCH(request: Request) {
  if (!isSupabaseConfigured()) {
    return bad("Supabase niet geconfigureerd", 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return bad("Ongeldige JSON");
  }

  const prefs = parseDiscoveryPreferencesJson(body);
  if (!prefs) return bad("Ongeldige discovery-voorkeuren");

  let supabase: ReturnType<typeof createClient>;
  try {
    supabase = createClient();
  } catch {
    return bad("Server verkeerd geconfigureerd", 503);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return bad("Niet geautoriseerd", 401);

  const { error } = await supabase
    .from("user_profiles")
    .update({
      discovery_prefs: discoveryPrefsToJson(prefs),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (error) {
    console.error("[PATCH /api/me/discovery-preferences]", error);
    return bad("Voorkeuren opslaan mislukt", 500);
  }

  return NextResponse.json({ ok: true, prefs });
}
