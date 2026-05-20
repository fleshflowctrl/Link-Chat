import { isFunnelGuestUser } from "@/lib/auth/guest-session-server";
import { hasServerDevBypassCookie } from "@/lib/dev-bypass-server";
import {
  readServerAppVariant,
  withVariantPath,
  type AppVariant,
} from "@/lib/app-variant";
import { createClient } from "@/utils/supabase/server";
import { isSupabaseConfigured } from "@/utils/supabase/public-env";

export type MeAccess = {
  requiresAuthGate: boolean;
  returnPath: string;
  variant: AppVariant;
};

/** Guests and signed-out users see signup/login on /me instead of profile settings. */
export async function resolveMeAccess(): Promise<MeAccess> {
  const variant = await readServerAppVariant();
  const returnPath = withVariantPath("/me", variant);

  if (hasServerDevBypassCookie() || !isSupabaseConfigured()) {
    return { requiresAuthGate: false, returnPath, variant };
  }

  let supabase: ReturnType<typeof createClient>;
  try {
    supabase = createClient();
  } catch {
    return { requiresAuthGate: false, returnPath, variant };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || isFunnelGuestUser(user)) {
    return { requiresAuthGate: true, returnPath, variant };
  }

  return { requiresAuthGate: false, returnPath, variant };
}
