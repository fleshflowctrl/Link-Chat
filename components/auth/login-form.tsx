"use client";

import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { hydrateClientSessionFromServer } from "@/lib/client-user-session";
import { SITE_DISPLAY } from "@/lib/brand";
import { LEGAL_PATHS } from "@/lib/legal/constants";
import {
  convertAnonymousToPermanentAccount,
  isPermanentAuthUser,
} from "@/lib/auth/guest-session";
import { applyServerCreditsUpdate } from "@/lib/credits-store";
import { trackSignupLink } from "@/lib/analytics/visitor-id";
import { mapSupabaseAuthError } from "@/lib/auth/error-messages";
import {
  type AppVariant,
  withVariantPath,
} from "@/lib/app-variant";
import { V2_GRADIENT_PRIMARY } from "@/lib/v2-theme";
import { createClient } from "@/utils/supabase/client";

type LoginFormMode = "login" | "signup";

const PASSWORD_MIN = 6;

function PasswordField({
  id,
  label,
  labelClass,
  inputClass,
  value,
  onChange,
  placeholder,
  autoComplete,
  visible,
  onToggleVisible,
  required = true,
  minLength,
  hint,
}: {
  id: string;
  label: string;
  labelClass: string;
  inputClass: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete: string;
  visible: boolean;
  onToggleVisible: () => void;
  required?: boolean;
  minLength?: number;
  hint?: string;
}) {
  return (
    <label className="block" htmlFor={id}>
      <span className={labelClass}>{label}</span>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required={required}
          minLength={minLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${inputClass} pr-11`}
        />
        <button
          type="button"
          onClick={onToggleVisible}
          className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-inkMuted transition hover:text-ink active:opacity-70"
          aria-label={visible ? "Wachtwoord verbergen" : "Wachtwoord tonen"}
        >
          {visible ? (
            <EyeOff className="h-[18px] w-[18px]" strokeWidth={2.2} />
          ) : (
            <Eye className="h-[18px] w-[18px]" strokeWidth={2.2} />
          )}
        </button>
      </div>
      {hint ? <p className="mt-1 text-[11px] text-inkMuted">{hint}</p> : null}
    </label>
  );
}

export function LoginForm({
  mode = "login",
  nextPathOverride,
  embedded = false,
  seamless = false,
  appVariant = "v2",
}: {
  mode?: LoginFormMode;
  /** When set (e.g. profile gate), used instead of `?next=` from the URL. */
  nextPathOverride?: string;
  /** Compact layout for in-tab profile gate (no duplicate header / footer). */
  embedded?: boolean;
  /** No card wrapper — parent supplies the surface (profile gate). */
  seamless?: boolean;
  appVariant?: AppVariant;
}) {
  const isV2 = appVariant === "v2";
  const defaultAfterAuth = withVariantPath("/messages", appVariant);
  const loginPath = withVariantPath("/login", appVariant);
  const funnelEntry = "/";
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => {
    const override = nextPathOverride?.trim();
    if (override && override.startsWith("/") && !override.startsWith("//")) {
      return override;
    }
    const n = searchParams.get("next");
    if (!n || !n.startsWith("/") || n.startsWith("//")) return defaultAfterAuth;
    return n;
  }, [searchParams, nextPathOverride, defaultAfterAuth]);
  const errorParam = searchParams.get("error");

  const authToggleQuery = useMemo(() => {
    if (nextPathOverride) return "";
    const q = new URLSearchParams();
    if (nextPath && nextPath !== defaultAfterAuth) q.set("next", nextPath);
    const s = q.toString();
    return s ? `?${s}` : "";
  }, [nextPath, nextPathOverride]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptMarketing, setAcceptMarketing] = useState(false);

  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.length,
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !password) return;

    if (mode === "signup") {
      if (!acceptTerms) {
        setStatus("error");
        setMessage("Accepteer de voorwaarden en het privacybeleid om door te gaan.");
        return;
      }
      if (password.length < PASSWORD_MIN) {
        setStatus("error");
        setMessage(`Wachtwoord moet minimaal ${PASSWORD_MIN} tekens zijn.`);
        return;
      }
      if (password !== confirmPassword) {
        setStatus("error");
        setMessage("Wachtwoorden komen niet overeen.");
        return;
      }
    }

    setStatus("loading");
    const supabase = createClient();
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmed,
        password,
      });
      if (error) {
        setStatus("error");
        setMessage(mapSupabaseAuthError(error.message));
        return;
      }
      await hydrateClientSessionFromServer();
      router.replace(nextPath);
      router.refresh();
      return;
    }

    const {
      data: { user: current },
    } = await supabase.auth.getUser();

    if (current && !isPermanentAuthUser(current)) {
      const converted = await convertAnonymousToPermanentAccount({
        email: trimmed,
        password,
        nextPath,
      });
      if (!converted.ok) {
        setStatus("error");
        setMessage(mapSupabaseAuthError(converted.error));
        return;
      }
      void trackSignupLink(converted.userId);
      await hydrateClientSessionFromServer();
      router.replace(nextPath);
      router.refresh();
      return;
    }

    const signupRes = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        email: trimmed,
        password,
        next: nextPath,
      }),
    });

    const signupData = (await signupRes.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      userId?: string;
      access_token?: string;
      refresh_token?: string;
      signupCredits?: number;
    };

    if (!signupRes.ok || !signupData.ok) {
      setStatus("error");
      setMessage(
        signupData.error ??
          (signupRes.status === 503
            ? "Registratie-server niet geconfigureerd (service role ontbreekt)."
            : `Registreren mislukt (${signupRes.status})`),
      );
      return;
    }

    if (signupData.access_token && signupData.refresh_token) {
      const { error: sessionErr } = await supabase.auth.setSession({
        access_token: signupData.access_token,
        refresh_token: signupData.refresh_token,
      });
      if (sessionErr) {
        setStatus("error");
        setMessage(mapSupabaseAuthError(sessionErr.message));
        return;
      }
    } else {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: trimmed,
        password,
      });
      if (signInErr) {
        setStatus("error");
        setMessage(mapSupabaseAuthError(signInErr.message));
        return;
      }
    }

    if (typeof signupData.signupCredits === "number" && signupData.signupCredits >= 0) {
      applyServerCreditsUpdate(signupData.signupCredits);
    }
    void trackSignupLink(signupData.userId ?? null);
    await hydrateClientSessionFromServer();
    router.replace(nextPath);
    router.refresh();
  }

  if (!supabaseConfigured) {
    const title = mode === "signup" ? "Registreren" : "Inloggen";
    return (
      <div className="rounded-3xl bg-canvas p-8 shadow-card ring-1 ring-black/[0.06]">
        <h1 className="font-serif text-2xl font-semibold text-ink">{title}</h1>
        <p className="mt-3 text-sm text-inkMuted">
          Voeg <code className="rounded bg-black/[0.06] px-1">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
          en{" "}
          <code className="rounded bg-black/[0.06] px-1">
            NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
          </code>{" "}
          toe aan <code className="rounded bg-black/[0.06] px-1">.env.local</code>.
        </p>
        <p className="mt-6 text-center text-sm text-inkMuted">
          {mode === "signup" ? (
            <>
              Heb je al een account?{" "}
              <Link
                href={`${loginPath}${authToggleQuery}`}
                className="font-semibold text-primary underline-offset-2 hover:underline"
              >
                Inloggen
              </Link>
            </>
          ) : (
            <>
              Nieuw hier?{" "}
              <Link
                href={`${funnelEntry}${authToggleQuery}`}
                className="font-semibold text-primary underline-offset-2 hover:underline"
              >
                Registreren
              </Link>
            </>
          )}
        </p>
      </div>
    );
  }

  const title = mode === "signup" ? "Registreren" : "Inloggen";
  const subtitle =
    mode === "signup"
      ? "Maak je account met e-mail en wachtwoord."
      : "Log in met je e-mail en wachtwoord.";

  const submitLabel = embedded
    ? mode === "signup"
      ? status === "loading"
        ? "Bezig…"
        : "Account aanmaken"
      : status === "loading"
        ? "Bezig…"
        : "Doorgaan"
    : mode === "signup"
      ? status === "loading"
        ? "Account aanmaken…"
        : "Account aanmaken"
      : status === "loading"
        ? "Bezig met inloggen…"
        : "Inloggen";

  const cardClass =
    seamless && embedded
      ? ""
      : embedded
        ? isV2
          ? "rounded-2xl bg-[#2A2A2B] p-3.5 shadow-card ring-1 ring-white/10"
          : "rounded-2xl bg-canvas p-3.5 shadow-card ring-1 ring-black/[0.06]"
        : "rounded-3xl bg-canvas p-8 shadow-card ring-1 ring-black/[0.06]";

  const labelClass = embedded
    ? "text-[11px] font-semibold text-inkMuted"
    : "text-xs font-bold uppercase tracking-wide text-inkMuted";

  const embeddedInputH =
    embedded && mode === "signup" ? "h-10" : embedded ? "h-11" : "h-12";

  const inputClass = embedded
    ? isV2
      ? `mt-1.5 ${embeddedInputH} w-full rounded-xl border-0 bg-[#1D1D1E] px-3.5 text-[15px] text-ink ring-1 ring-white/[0.08] outline-none placeholder:text-inkMuted/80 focus:ring-2 focus:ring-[#B52B2A]/40`
      : `mt-1.5 ${embeddedInputH} w-full rounded-xl border-0 bg-[#F8F6F1] px-3.5 text-[15px] text-ink ring-1 ring-black/[0.06] outline-none placeholder:text-inkMuted focus:ring-2 focus:ring-primary/35`
    : "mt-1.5 h-12 w-full rounded-2xl border-0 bg-white px-4 text-[15px] text-ink shadow-card ring-1 ring-black/[0.06] outline-none placeholder:text-inkMuted focus:ring-2 focus:ring-primary/35";

  const submitClass = embedded
    ? `mt-0.5 ${mode === "signup" ? "h-10" : "h-11"} rounded-full text-[14px] font-bold text-white shadow-md transition enabled:active:scale-[0.98] disabled:opacity-60`
    : "h-12 rounded-full bg-gradient-primary text-[15px] font-bold text-white shadow-md transition enabled:active:scale-[0.98] disabled:opacity-60";

  const submitStyle =
    embedded && isV2 ? { background: V2_GRADIENT_PRIMARY } : undefined;

  const submitClassFinal =
    embedded && !isV2
      ? `${submitClass} bg-gradient-primary`
      : embedded && isV2
        ? submitClass
        : `${submitClass} bg-gradient-primary`;

  const showConfirmPassword = mode === "signup";

  return (
    <div className={seamless && embedded ? "" : cardClass}>
      {!embedded && (
        <>
          <p className="text-center font-serif text-sm font-medium uppercase tracking-[0.2em] text-primary">
            {SITE_DISPLAY}
          </p>
          <h1 className="mt-2 text-center font-serif text-2xl font-semibold text-ink">
            {title}
          </h1>
          <p className="mt-2 text-center text-sm text-inkMuted">{subtitle}</p>
        </>
      )}

      {errorParam && (
        <p
          className={`${embedded ? "mt-0" : "mt-4"} rounded-xl bg-red-50 px-3 py-2 text-[12px] text-red-700 ring-1 ring-red-100`}
        >
          {errorParam === "config"
            ? "Serverconfiguratiefout."
            : decodeURIComponent(errorParam)}
        </p>
      )}

      <form
          onSubmit={onSubmit}
          className={`flex flex-col ${embedded ? (mode === "signup" ? "gap-2" : "gap-2.5") : "mt-6 gap-4"}`}
        >
          <label className="block">
            <span className={labelClass}>E-mailadres</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jij@voorbeeld.nl"
              className={inputClass}
            />
          </label>
          <PasswordField
            id="login-password"
            label="Wachtwoord"
            labelClass={labelClass}
            inputClass={inputClass}
            value={password}
            onChange={setPassword}
            placeholder={
              mode === "signup" && embedded
                ? `min. ${PASSWORD_MIN} tekens`
                : "••••••••"
            }
            autoComplete={
              mode === "signup" ? "new-password" : "current-password"
            }
            minLength={mode === "signup" ? PASSWORD_MIN : undefined}
            visible={passwordVisible}
            onToggleVisible={() => setPasswordVisible((v) => !v)}
            hint={
              mode === "signup" && !embedded
                ? `Minimaal ${PASSWORD_MIN} tekens`
                : undefined
            }
          />
          {showConfirmPassword && (
            <PasswordField
              id="login-password-confirm"
              label="Herhaal wachtwoord"
              labelClass={labelClass}
              inputClass={inputClass}
              value={confirmPassword}
              onChange={setConfirmPassword}
              placeholder="••••••••"
              autoComplete="new-password"
              visible={confirmVisible}
              onToggleVisible={() => setConfirmVisible((v) => !v)}
            />
          )}
          {mode === "signup" && (
            <div className="space-y-2 text-[12px] leading-snug text-inkMuted">
              <label className="flex gap-2">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-0.5 rounded border-neutral-300"
                  required
                />
                <span>
                  Ik ga akkoord met de{" "}
                  <Link
                    href={LEGAL_PATHS.terms}
                    className="font-medium text-primary underline-offset-2 hover:underline"
                    target="_blank"
                  >
                    algemene voorwaarden
                  </Link>{" "}
                  en het{" "}
                  <Link
                    href={LEGAL_PATHS.privacy}
                    className="font-medium text-primary underline-offset-2 hover:underline"
                    target="_blank"
                  >
                    privacybeleid
                  </Link>
                  . Ik ben 18 jaar of ouder.
                </span>
              </label>
              <label className="flex gap-2">
                <input
                  type="checkbox"
                  checked={acceptMarketing}
                  onChange={(e) => setAcceptMarketing(e.target.checked)}
                  className="mt-0.5 rounded border-neutral-300"
                />
                <span>
                  Ja, stuur mij e-mails over acties en nieuws (optioneel, afmelden
                  kan altijd).
                </span>
              </label>
            </div>
          )}
          {message && status === "error" && (
            <p className="text-[12px] text-red-600">{message}</p>
          )}
          <button
            type="submit"
            disabled={status === "loading"}
            className={submitClassFinal}
            style={submitStyle}
          >
            {submitLabel}
          </button>
        </form>

      {!embedded && (
        <p className="mt-6 text-center text-sm text-inkMuted">
          {mode === "signup" ? (
            <>
              Heb je al een account?{" "}
              <Link
                href={`${loginPath}${authToggleQuery}`}
                className="font-semibold text-primary underline-offset-2 hover:underline"
              >
                Inloggen
              </Link>
            </>
          ) : (
            <>
              Nieuw hier?{" "}
              <Link
                href={`${funnelEntry}${authToggleQuery}`}
                className="font-semibold text-primary underline-offset-2 hover:underline"
              >
                Registreren
              </Link>
            </>
          )}
        </p>
      )}
    </div>
  );
}
