"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type LoginFormMode = "login" | "signup";

export function LoginForm({ mode = "login" }: { mode?: LoginFormMode }) {
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
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  const supabaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.length,
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) return;

    setStatus("sending");
    const supabase = createClient();
    const origin = window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });

    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }

    setStatus("sent");
    setMessage("Check your email for the sign-in link.");
  }

  if (!supabaseConfigured) {
    const title = mode === "signup" ? "Sign up" : "Sign in";
    return (
      <div className="rounded-3xl bg-canvas p-8 shadow-card ring-1 ring-black/[0.06]">
        <h1 className="font-serif text-2xl font-semibold text-ink">{title}</h1>
        <p className="mt-3 text-sm text-inkMuted">
          Add <code className="rounded bg-black/[0.06] px-1">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
          and{" "}
          <code className="rounded bg-black/[0.06] px-1">
            NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
          </code>{" "}
          to <code className="rounded bg-black/[0.06] px-1">.env.local</code>.
        </p>
        <p className="mt-6 text-center text-sm text-inkMuted">
          {mode === "signup" ? (
            <>
              Already have an account?{" "}
              <Link
                href={`/login${authToggleQuery}`}
                className="font-semibold text-primary underline-offset-2 hover:underline"
              >
                Sign in
              </Link>
            </>
          ) : (
            <>
              New here?{" "}
              <Link
                href={`/signup${authToggleQuery}`}
                className="font-semibold text-primary underline-offset-2 hover:underline"
              >
                Sign up
              </Link>
            </>
          )}
        </p>
      </div>
    );
  }

  const title = mode === "signup" ? "Sign up" : "Sign in";
  const subtitle =
    mode === "signup"
      ? "Create your account — we'll email you a magic link. No password needed."
      : "We'll email you a magic link — no password to remember.";

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
            ? "Server configuration error."
            : decodeURIComponent(errorParam)}
        </p>
      )}

      {status === "sent" ? (
        <p className="mt-6 rounded-2xl bg-lavender px-4 py-4 text-center text-sm font-medium text-ink ring-1 ring-primary/15">
          {message}
        </p>
      ) : (
        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-inkMuted">
              Email
            </span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="mt-1.5 h-12 w-full rounded-2xl border-0 bg-white px-4 text-[15px] text-ink shadow-card ring-1 ring-black/[0.06] outline-none placeholder:text-inkMuted focus:ring-2 focus:ring-primary/35"
            />
          </label>
          {message && status === "error" && (
            <p className="text-sm text-red-600">{message}</p>
          )}
          <button
            type="submit"
            disabled={status === "sending"}
            className="h-12 rounded-full bg-gradient-primary text-[15px] font-bold text-white shadow-md transition enabled:active:scale-[0.98] disabled:opacity-60"
          >
            {status === "sending" ? "Sending…" : "Email me a link"}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-inkMuted">
        {mode === "signup" ? (
          <>
            Already have an account?{" "}
            <Link
              href={`/login${authToggleQuery}`}
              className="font-semibold text-primary underline-offset-2 hover:underline"
            >
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{" "}
            <Link
              href={`/signup${authToggleQuery}`}
              className="font-semibold text-primary underline-offset-2 hover:underline"
            >
              Sign up
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
