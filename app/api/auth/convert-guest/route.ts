import { NextResponse } from "next/server";
import { convertGuestToPermanentAccountServer } from "@/lib/auth/convert-guest-server";
import { isGuestAuthUser } from "@/lib/auth/user-account";
import {
  discoveryPrefsToJson,
  funnelInputToDiscoveryPrefs,
} from "@/lib/discovery-preferences-server";
import { createClient } from "@/utils/supabase/server";
import { isSupabaseConfigured } from "@/utils/supabase/public-env";

export const dynamic = "force-dynamic";

const PASSWORD_MIN = 6;

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

/**
 * Convert the current guest/anonymous session to a permanent email/password account.
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, skipped: true, needsEmailConfirm: false });
  }

  let body: {
    email?: string;
    password?: string;
    nickname?: string;
    age?: number;
    city?: string;
    gender?: string;
    seekingGender?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return bad("Ongeldige JSON");
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const nickname = typeof body.nickname === "string" ? body.nickname.trim() : "";
  const city = typeof body.city === "string" ? body.city.trim() : "";
  const ageRaw = body.age;
  const age =
    typeof ageRaw === "number" && Number.isFinite(ageRaw)
      ? Math.round(ageRaw)
      : NaN;
  const genderRaw = typeof body.gender === "string" ? body.gender.trim() : "";
  const seekingGenderRaw =
    typeof body.seekingGender === "string" ? body.seekingGender.trim() : "";
  const gender = genderRaw === "man" || genderRaw === "woman" ? genderRaw : "";
  const seekingGender =
    seekingGenderRaw === "men" || seekingGenderRaw === "women"
      ? seekingGenderRaw
      : "";

  if (!email || !email.includes("@")) {
    return bad("Ongeldig e-mailadres");
  }
  if (!nickname) {
    return bad("Vul een nickname in.");
  }
  if (!Number.isFinite(age) || age < 18 || age > 120) {
    return bad("Vul een geldige leeftijd in (18–120).");
  }
  if (!city) {
    return bad("Vul je stad in.");
  }
  if (!gender) {
    return bad("Kies of je een man of vrouw bent.");
  }
  if (!seekingGender) {
    return bad("Kies of je een man of vrouw zoekt.");
  }
  if (password.length < PASSWORD_MIN) {
    return bad(`Wachtwoord moet minimaal ${PASSWORD_MIN} tekens zijn`);
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
    return bad("Niet ingelogd", 401);
  }

  if (!isGuestAuthUser(user)) {
    return bad("Geen gast-account om te koppelen");
  }

  const result = await convertGuestToPermanentAccountServer({
    userId: user.id,
    email,
    password,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 400 },
    );
  }

  const discoveryPrefs = funnelInputToDiscoveryPrefs({
    lookingFor: null,
    seekingGender,
    ageRange: { min: 18, max: 80, anyAge: true },
  });

  // Save basic profile fields while we still have the guest session.
  await supabase
    .from("user_profiles")
    .upsert(
      {
        user_id: user.id,
        first_name: nickname,
        age,
        location: city,
        gender,
        seeking_gender: seekingGender,
        discovery_prefs: discoveryPrefsToJson(discoveryPrefs),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  return NextResponse.json({
    ok: true,
    userId: result.userId,
    needsEmailConfirm: result.needsEmailConfirm,
    access_token: result.accessToken,
    refresh_token: result.refreshToken,
    signupCredits: result.signupCredits,
  });
}
