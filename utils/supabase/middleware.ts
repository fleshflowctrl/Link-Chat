import { createServerClient } from "@supabase/ssr";
import { type User } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { getSupabasePublicEnv } from "@/utils/supabase/public-env";

export type SessionUpdate = {
  response: NextResponse;
  user: User | null;
  supabaseConfigured: boolean;
};

/**
 * Refreshes the Supabase session from cookies. Call this from root `middleware.ts`.
 * Do not add logic between `createServerClient` and `getUser()` beyond what you need.
 */
export async function updateSession(request: NextRequest): Promise<SessionUpdate> {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const publicEnv = getSupabasePublicEnv();
  if (!publicEnv) {
    return { response: supabaseResponse, user: null, supabaseConfigured: false };
  }

  const { url: supabaseUrl, key: supabaseKey } = publicEnv;

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    response: supabaseResponse,
    user: user ?? null,
    supabaseConfigured: true,
  };
}
