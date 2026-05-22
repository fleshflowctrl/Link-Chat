"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAppVariant } from "@/components/app-variant-provider";
import {
  readClientAppVariant,
  variantFromPathname,
  withVariantPath,
} from "@/lib/app-variant";
import { clearClientCachesOnLogout } from "@/lib/client-user-session";
import { createClient } from "@/utils/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const { variant: layoutVariant } = useAppVariant();
  const [pending, setPending] = useState(false);

  function postLogoutPath(): string {
    const fromPath =
      typeof window !== "undefined"
        ? variantFromPathname(window.location.pathname)
        : null;
    const variant = fromPath === "v2" ? "v2" : layoutVariant ?? readClientAppVariant();
    return withVariantPath("/login", variant);
  }

  async function signOut() {
    setPending(true);
    try {
      await fetch("/api/dev/bypass", { method: "DELETE" }).catch(() => {});
      const supabase = createClient();
      await supabase.auth.signOut();
      clearClientCachesOnLogout();
      router.push(postLogoutPath());
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => void signOut()}
      className="inline-flex min-h-[48px] w-full max-w-xs items-center justify-center rounded-2xl bg-white px-5 py-3 text-sm font-bold text-ink shadow-card ring-1 ring-black/[0.08] transition enabled:active:scale-[0.99] disabled:opacity-50"
    >
      {pending ? "Bezig met uitloggen…" : "Uitloggen"}
    </button>
  );
}
