import { type NextRequest } from "next/server";
import { grokSmokeTestGuard } from "@/lib/grok-smoke-guard";
import { grokSmokeTestResponse } from "@/lib/grok-smoke-test";

export const dynamic = "force-dynamic";

/** Typo alias for `/api/grok-test`. */
export async function GET(request: NextRequest) {
  const denied = grokSmokeTestGuard(request);
  if (denied) return denied;
  return grokSmokeTestResponse();
}
