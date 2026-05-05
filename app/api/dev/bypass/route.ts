import { NextResponse } from "next/server";
import {
  DEV_BYPASS_COOKIE,
  DEV_BYPASS_VALUE,
  isDevBypassFeatureEnabled,
} from "@/lib/dev-bypass-config";

function forbidden() {
  return NextResponse.json({ ok: false, error: "Not available" }, { status: 404 });
}

export async function POST() {
  if (!isDevBypassFeatureEnabled()) return forbidden();

  const res = NextResponse.json({ ok: true });
  res.cookies.set(DEV_BYPASS_COOKIE, DEV_BYPASS_VALUE, {
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}

export async function DELETE() {
  if (!isDevBypassFeatureEnabled()) return forbidden();

  const res = NextResponse.json({ ok: true });
  res.cookies.set(DEV_BYPASS_COOKIE, "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
