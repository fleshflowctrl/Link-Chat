"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useAppVariant } from "@/components/app-variant-provider";
import { withVariantPath } from "@/lib/app-variant";

export function GuestMessageAuthPrompt({
  open,
  onClose,
  returnPath,
  profileName,
}: {
  open: boolean;
  onClose: () => void;
  returnPath: string;
  profileName?: string;
}) {
  const { variant } = useAppVariant();
  const isV2 = variant === "v2";
  const [mounted, setMounted] = useState(false);

  const loginHref = withVariantPath(
    `/login?next=${encodeURIComponent(returnPath)}`,
    variant,
  );
  const signupHref = withVariantPath(
    `/signup?next=${encodeURIComponent(returnPath)}`,
    variant,
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200]">
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        aria-label="Sluiten"
        onClick={onClose}
      />
      <div
        className={`absolute inset-x-0 bottom-0 mx-auto max-w-[430px] rounded-t-3xl px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5 shadow-2xl sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-3xl ${
          isV2 ? "bg-[#252526] ring-1 ring-white/10" : "bg-white"
        }`}
        role="dialog"
        aria-labelledby="guest-auth-title"
        aria-modal="true"
      >
        <div className="mb-4 flex justify-center sm:hidden">
          <div
            className={`h-1 w-10 rounded-full ${isV2 ? "bg-white/15" : "bg-gray-200"}`}
          />
        </div>

        <div className="flex flex-col items-center text-center">
          <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[#B52B2A] to-[#D63B3A] text-white shadow-md">
            <MessageCircle className="h-7 w-7" strokeWidth={2.25} aria-hidden />
          </span>
          <h2
            id="guest-auth-title"
            className="text-[18px] font-extrabold text-ink"
          >
            Log in om te chatten
          </h2>
          <p
            className={`mt-3 max-w-[32ch] text-[13px] leading-snug ${
              isV2 ? "text-inkMuted" : "text-gray-600"
            }`}
          >
            {profileName
              ? `Maak een account aan of log in om een bericht te sturen naar ${profileName}.`
              : "Maak een account aan of log in om berichten te sturen."}
          </p>
        </div>

        <Link
          href={signupHref}
          className="mt-5 flex w-full items-center justify-center rounded-full bg-gradient-to-r from-[#B52B2A] to-[#D63B3A] py-3.5 text-[15px] font-extrabold text-white shadow-lg transition active:scale-[0.98]"
        >
          Account aanmaken
        </Link>
        <Link
          href={loginHref}
          className={`mt-2 flex w-full items-center justify-center rounded-full py-3.5 text-[15px] font-bold ring-1 transition active:scale-[0.98] ${
            isV2
              ? "bg-[#353536] text-white ring-white/10"
              : "bg-gray-100 text-gray-900 ring-black/10"
          }`}
        >
          Inloggen
        </Link>
        <button
          type="button"
          onClick={onClose}
          className={`mt-2 w-full py-2.5 text-[13px] font-semibold ${
            isV2 ? "text-inkMuted" : "text-gray-500"
          }`}
        >
          Later
        </button>
      </div>
    </div>,
    document.body,
  );
}
