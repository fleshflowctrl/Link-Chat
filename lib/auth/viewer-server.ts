import { hasServerDevBypassCookie } from "@/lib/dev-bypass-server";
import { isPermanentAuthUser } from "@/lib/auth/user-account";
import { isSupabaseConfigured } from "@/utils/supabase/public-env";
import { createClient } from "@/utils/supabase/server";

/** SSR helper — true when the current request comes from a permanent (logged-in) account. */
export async function getViewerIsPermanentServer(): Promise<boolean> {
  if (hasServerDevBypassCookie()) return true;
  if (!isSupabaseConfigured()) return false;

  let supabase: ReturnType<typeof createClient>;
  try {
    supabase = createClient();
  } catch {
    return false;
  }

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return isPermanentAuthUser(user);
  } catch {
    return false;
  }
}
