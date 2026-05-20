import { NextResponse } from "next/server";
import { convertGuestToPermanentAccountServer } from "@/lib/auth/convert-guest-server";
import { isGuestAuthUser } from "@/lib/auth/user-account";
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

  let body: { email?: string; password?: string };
  try {
    body = (await request.json()) as { email?: string; password?: string };
  } catch {
    return bad("Ongeldige JSON");
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !email.includes("@")) {
    return bad("Ongeldig e-mailadres");
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

  return NextResponse.json({
    ok: true,
    userId: result.userId,
    needsEmailConfirm: result.needsEmailConfirm,
    access_token: result.accessToken,
    refresh_token: result.refreshToken,
  });
}
