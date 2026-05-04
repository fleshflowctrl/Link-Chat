import { type NextRequest } from "next/server";
import { grokSmokeTestGuard } from "@/lib/grok-smoke-guard";
import { grokSmokeTestResponse } from "@/lib/grok-smoke-test";

export const dynamic = "force-dynamic";

/**
 * Smoke test for xAI Grok from the server.
 * Disabled in production. Optional `GROK_SMOKE_TEST_SECRET` + Authorization bearer in dev.
 */
export async function GET(request: NextRequest) {
  const denied = grokSmokeTestGuard(request);
  if (denied) return denied;
  return grokSmokeTestResponse();
}
