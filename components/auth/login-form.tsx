"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type LoginFormMode = "login" | "signup";

const PASSWORD_MIN = 6;

export function LoginForm({ mode = "login" }: { mode?: LoginFormMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = useMemo(() => {
    const n = searchParams.get("next");
    if (!n || !n.startsWith("/") || n.startsWith("//")) return "/";
    return n;
  }, [searchParams]);
  const errorParam = searchParams.get("error");

  const authToggleQuery = useMemo(() => {
    const q = new URLSearchParams();
    if (nextPath && nextPath !== "/") q.set("next", nextPath);
    const s = q.toString();
    return s ? `?${s}` : "";
  }, [nextPath]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "needs_confirm" | "error"
  >("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [testBypassLoading, setTestBypassLoading] = useState(false);

  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.length,
  );

  async function continueWithoutLogin() {
    setMessage(null);
    setTestBypassLoading(true);
    try {
      const res = await fetch("/api/dev/bypass", { method: "POST" });
      if (!res.ok) {
        setStatus("error");
        setMessage(
          "Test-bypass staat uit voor deze host. Gebruik je een eigen domein? Zet ALLOW_TEST_BYPASS=1 of NEXT_PUBLIC_ALLOW_TEST_BYPASS=true en deploy opnieuw.",
        );
        return;
      }
      router.replace(nextPath);
      router.refresh();
    } finally {
      setTestBypassLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !password) return;

    if (mode === "signup") {
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
    const origin = window.location.origin;
    const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmed,
        password,
      });
      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }
      router.replace(nextPath);
      router.refresh();
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email: trimmed,
      password,
      options: { emailRedirectTo },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    if (data.session) {
      router.replace(nextPath);
      router.refresh();
      return;
    }

    setStatus("needs_confirm");
    setMessage(
      "Controleer je e-mail om je account te bevestigen en log daarna hier in.",
    );
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
                href={`/login${authToggleQuery}`}
                className="font-semibold text-primary underline-offset-2 hover:underline"
              >
                Inloggen
              </Link>
            </>
          ) : (
            <>
              Nieuw hier?{" "}
              <Link
                href={`/signup${authToggleQuery}`}
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

  const submitLabel =
    mode === "signup"
      ? status === "loading"
        ? "Account aanmaken…"
        : "Account aanmaken"
      : status === "loading"
        ? "Bezig met inloggen…"
        : "Inloggen";

  return (
    <div className="rounded-3xl bg-canvas p-8 shadow-card ring-1 ring-black/[0.06]">
      <p className="text-center font-serif text-sm font-medium uppercase tracking-[0.2em] text-primary">
        whisper
      </p>
      <h1 className="mt-2 text-center font-serif text-2xl font-semibold text-ink">
        {title}
      </h1>
      <p className="mt-2 text-center text-sm text-inkMuted">{subtitle}</p>

      {errorParam && (
        <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
          {errorParam === "config"
            ? "Serverconfiguratiefout."
            : decodeURIComponent(errorParam)}
        </p>
      )}

      {status === "needs_confirm" ? (
        <p className="mt-6 rounded-2xl bg-lavender px-4 py-4 text-center text-sm font-medium text-ink ring-1 ring-primary/15">
          {message}
        </p>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-inkMuted">
              E-mail
            </span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jij@voorbeeld.nl"
              className="mt-1.5 h-12 w-full rounded-2xl border-0 bg-white px-4 text-[15px] text-ink shadow-card ring-1 ring-black/[0.06] outline-none placeholder:text-inkMuted focus:ring-2 focus:ring-primary/35"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-inkMuted">
              Wachtwoord
            </span>
            <input
              type="password"
              autoComplete={
                mode === "signup" ? "new-password" : "current-password"
              }
              required
              minLength={mode === "signup" ? PASSWORD_MIN : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1.5 h-12 w-full rounded-2xl border-0 bg-white px-4 text-[15px] text-ink shadow-card ring-1 ring-black/[0.06] outline-none placeholder:text-inkMuted focus:ring-2 focus:ring-primary/35"
            />
            {mode === "signup" && (
              <p className="mt-1 text-[11px] text-inkMuted">
                Minimaal {PASSWORD_MIN} tekens
              </p>
            )}
          </label>
          {mode === "signup" && (
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-inkMuted">
                Wachtwoord bevestigen
              </span>
              <input
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1.5 h-12 w-full rounded-2xl border-0 bg-white px-4 text-[15px] text-ink shadow-card ring-1 ring-black/[0.06] outline-none placeholder:text-inkMuted focus:ring-2 focus:ring-primary/35"
              />
            </label>
          )}
          {message && status === "error" && (
            <p className="text-sm text-red-600">{message}</p>
          )}
          <button
            type="submit"
            disabled={status === "loading"}
            className="h-12 rounded-full bg-gradient-primary text-[15px] font-bold text-white shadow-md transition enabled:active:scale-[0.98] disabled:opacity-60"
          >
            {submitLabel}
          </button>
        </form>
      )}

      {supabaseConfigured && (
        <div className="mt-5 rounded-2xl border border-dashed border-amber-400/60 bg-amber-50/80 px-4 py-3">
          <p className="text-center text-[11px] font-medium text-amber-900/80">
            Sla inloggen over voor UI-testen (localhost, *.vercel.app, of zet
            ALLOW_TEST_BYPASS op een eigen domein)
          </p>
          <button
            type="button"
            disabled={testBypassLoading}
            onClick={() => void continueWithoutLogin()}
            className="mt-2 flex h-11 w-full items-center justify-center rounded-full bg-amber-200/90 text-[13px] font-bold text-amber-950 transition enabled:active:scale-[0.98] disabled:opacity-60"
          >
            {testBypassLoading ? "Openen…" : "Doorgaan zonder inloggen"}
          </button>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-inkMuted">
        {mode === "signup" ? (
          <>
            Heb je al een account?{" "}
            <Link
              href={`/login${authToggleQuery}`}
              className="font-semibold text-primary underline-offset-2 hover:underline"
            >
              Inloggen
            </Link>
          </>
        ) : (
          <>
            Nieuw hier?{" "}
            <Link
              href={`/signup${authToggleQuery}`}
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
