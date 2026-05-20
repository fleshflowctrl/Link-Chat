import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  GUEST_UID_COOKIE,
  mintGuestSessionTokens,
} from "@/lib/auth/guest-session-server";
import { isSupabaseConfigured } from "@/utils/supabase/public-env";

export const dynamic = "force-dynamic";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  try {
    const cookieStore = cookies();
    const existing = cookieStore.get(GUEST_UID_COOKIE)?.value ?? null;
    const tokens = await mintGuestSessionTokens(existing);

    const res = NextResponse.json({
      ok: true,
      userId: tokens.userId,
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    });

    res.cookies.set(GUEST_UID_COOKIE, tokens.guestUid, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });

    return res;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Gast-sessie mislukt";
    console.error("[POST /api/auth/guest-session]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
