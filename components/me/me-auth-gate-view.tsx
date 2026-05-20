"use client";

import { Suspense, useState } from "react";
import { User } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";
import type { AppVariant } from "@/lib/app-variant";
import { V2_GRADIENT_PRIMARY, V2_THEME } from "@/lib/v2-theme";

function AuthFormFallback({ variant }: { variant: AppVariant }) {
  const isV2 = variant === "v2";
  return (
    <div
      className={`h-36 animate-pulse rounded-xl ${
        isV2 ? "bg-[#353536]/60" : "bg-black/[0.04]"
      }`}
    />
  );
}

function ModeToggle({
  mode,
  onChange,
  isV2,
}: {
  mode: "signup" | "login";
  onChange: (m: "signup" | "login") => void;
  isV2: boolean;
}) {
  const trackClass = isV2
    ? "flex rounded-xl bg-[#1D1D1E] p-1 ring-1 ring-white/[0.06]"
    : "flex rounded-xl bg-black/[0.04] p-1 ring-1 ring-black/[0.06]";

  const activeClass = isV2
    ? "rounded-lg py-2.5 text-[13px] font-bold text-white shadow-sm"
    : "rounded-lg py-2.5 text-[13px] font-bold text-white shadow-sm bg-gradient-primary";

  const inactiveClass = isV2
    ? "rounded-lg py-2.5 text-[13px] font-semibold text-inkMuted transition hover:text-ink"
    : "rounded-lg py-2.5 text-[13px] font-semibold text-inkMuted transition hover:text-ink";

  return (
    <div className={trackClass} role="tablist" aria-label="Account actie">
      <button
        type="button"
        role="tab"
        aria-selected={mode === "signup"}
        onClick={() => onChange("signup")}
        className={`flex-1 ${mode === "signup" ? activeClass : inactiveClass}`}
        style={
          mode === "signup" && isV2
            ? { background: V2_GRADIENT_PRIMARY }
            : undefined
        }
      >
        Registreren
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "login"}
        onClick={() => onChange("login")}
        className={`flex-1 ${mode === "login" ? activeClass : inactiveClass}`}
        style={
          mode === "login" && isV2
            ? { background: V2_GRADIENT_PRIMARY }
            : undefined
        }
      >
        Inloggen
      </button>
    </div>
  );
}

export function MeAuthGateView({
  variant,
  returnPath,
}: {
  variant: AppVariant;
  returnPath: string;
}) {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const isV2 = variant === "v2";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 py-4">
      <div className="mx-auto flex w-full max-w-md min-h-0 flex-1 flex-col justify-center">
        <div className="shrink-0 text-center">
          <div
            className={`mx-auto mb-2.5 flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ${
              isV2
                ? "bg-[#B52B2A]/12 ring-[#B52B2A]/25"
                : "bg-lavender ring-primary/20"
            }`}
          >
            <User
              className={`h-5 w-5 ${isV2 ? "text-[#D63B3A]" : "text-primary"}`}
              strokeWidth={2.2}
            />
          </div>
          <h1 className="text-[1.125rem] font-bold tracking-tight text-ink">
            Je profiel
          </h1>
          <p className="mx-auto mt-1 max-w-[280px] text-[12px] leading-snug text-inkMuted">
            Bewaar je gesprekken en profiel op al je apparaten.
          </p>
        </div>

        <div
          className={`mt-4 rounded-2xl p-4 shadow-lg ring-1 ${
            isV2
              ? "bg-[#252526] ring-white/[0.08]"
              : "bg-white ring-black/[0.06]"
          }`}
          style={
            isV2
              ? { boxShadow: `0 12px 40px -16px rgba(0,0,0,0.55), 0 0 0 1px ${V2_THEME.border}` }
              : undefined
          }
        >
          <ModeToggle mode={mode} onChange={setMode} isV2={isV2} />

          <div className="mt-3">
            <Suspense fallback={<AuthFormFallback variant={variant} />}>
              <LoginForm
                key={mode}
                mode={mode}
                embedded
                seamless
                appVariant={variant}
                nextPathOverride={returnPath}
              />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
