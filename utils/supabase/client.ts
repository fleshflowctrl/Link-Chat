import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "@/utils/supabase/public-env";

export function createClient() {
  const env = getSupabasePublicEnv();
  if (!env) {
    throw new Error(
      "Missing Supabase env: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)",
    );
  }
  return createBrowserClient(env.url, env.key);
}
