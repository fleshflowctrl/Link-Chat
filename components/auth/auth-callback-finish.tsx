"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { hydrateClientSessionFromServer } from "@/lib/client-user-session";
import { createClient } from "@/utils/supabase/client";

const EMAIL_OTP_TYPES = new Set([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

export function AuthCallbackFinish() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [hint, setHint] = useState("Inloggen afronden…");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const run = async () => {
      const code = searchParams.get("code");
      const token_hash = searchParams.get("token_hash");
      const type = searchParams.get("type");
      const nextRaw = searchParams.get("next") ?? "/discover";
      const next =
        nextRaw.startsWith("/") && !nextRaw.startsWith("//")
          ? nextRaw
          : "/discover";

      const supabase = createClient();

      try {
        if (token_hash && type && EMAIL_OTP_TYPES.has(type)) {
          setHint("Je link controleren…");
          const { error } = await supabase.auth.verifyOtp({
            token_hash,
            type: type as
              | "signup"
              | "invite"
              | "magiclink"
              | "recovery"
              | "email_change"
              | "email",
          });
          if (error) throw error;
        } else if (code) {
          setHint("Je sessie beveiligen…");
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else {
          router.replace("/login?error=auth");
          return;
        }

        await hydrateClientSessionFromServer();
        router.replace(next);
        router.refresh();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "callback_failed";
        router.replace(`/login?error=${encodeURIComponent(msg)}`);
      }
    };

    void run();
  }, [router, searchParams]);

  return (
    <p className="rounded-2xl bg-canvas px-6 py-4 text-sm font-medium text-inkMuted shadow-card ring-1 ring-black/[0.06]">
      {hint}
    </p>
  );
}
