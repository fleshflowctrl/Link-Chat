import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getServiceSupabase } from "@/lib/supabase/admin";

export async function requireOperatorApi(): Promise<
  | { ok: true; operatorId: string; service: NonNullable<ReturnType<typeof getServiceSupabase>> }
  | { ok: false; response: NextResponse }
> {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: auth.error },
        { status: auth.status },
      ),
    };
  }
  const service = getServiceSupabase();
  if (!service) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY ontbreekt" },
        { status: 500 },
      ),
    };
  }
  return { ok: true, operatorId: auth.userId, service };
}
