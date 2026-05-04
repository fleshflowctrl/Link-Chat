import { type NextRequest, NextResponse } from "next/server";

/** Block smoke test in production; optional bearer secret in development. */
export function grokSmokeTestGuard(request: NextRequest): NextResponse | null {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const secret = process.env.GROK_SMOKE_TEST_SECRET?.trim();
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  return null;
}
