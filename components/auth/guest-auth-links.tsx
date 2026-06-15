"use client";

import Link from "next/link";
import { useAppVariant } from "@/components/app-variant-provider";
import { withVariantPath } from "@/lib/app-variant";

export function GuestAuthLinks({
  compact = false,
  onPhoto = false,
}: {
  compact?: boolean;
  /** Light text for use on dark photo overlays. */
  onPhoto?: boolean;
}) {
  const { variant } = useAppVariant();
  const loginHref = withVariantPath("/login", variant);
  const signupHref = withVariantPath("/signup", variant);

  const loginClass = onPhoto
    ? "rounded-full px-3 py-1.5 text-[11px] font-bold text-white/90 transition hover:text-white active:scale-[0.98]"
    : compact
      ? "rounded-full px-3 py-1.5 text-[11px] font-bold text-inkMuted transition hover:text-ink active:scale-[0.98]"
      : "rounded-full px-3.5 py-2 text-[12px] font-bold text-inkMuted transition hover:text-ink active:scale-[0.98]";

  const signupClass = compact || onPhoto
    ? "rounded-full bg-gradient-to-r from-[#B52B2A] to-[#D63B3A] px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition active:scale-[0.98]"
    : "rounded-full bg-gradient-to-r from-[#B52B2A] to-[#D63B3A] px-3.5 py-2 text-[12px] font-bold text-white shadow-sm transition active:scale-[0.98]";

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <Link href={loginHref} className={loginClass}>
        Inloggen
      </Link>
      <Link href={signupHref} className={signupClass}>
        Registreren
      </Link>
    </div>
  );
}
