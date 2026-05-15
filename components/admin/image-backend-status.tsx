"use client";

/**
 * Status strip showing how the image-generation pipeline is configured.
 *
 * Sits above the BulkGenerateCard so the operator can see at a glance
 * whether photos will work before clicking Generate. Three states:
 *
 *   ✓ green   — HF_TOKEN present and resolves to a real account.
 *               If the account is HF Pro we surface the "ZeroGPU prio"
 *               hint because that's the practical knob that fixes the
 *               cold-start problem we hit during testing.
 *   !  amber  — Token is set but whoami fails (revoked? typo? offline?)
 *   ✕ rose    — Backend is anonymous OR set to stub. Photos will fail
 *               or be silently dropped.
 *
 * Intentionally compact — collapses to one row on most viewports, with
 * a "Details" disclosure for the raw fields. */

import { useEffect, useState } from "react";
import { CameraIcon, CheckIcon, XIcon } from "@/components/admin/icons";

type Diag = {
  backend: string;
  hf: {
    space: string;
    token_present: boolean;
    token_hint?: string;
    account?: {
      name?: string;
      type?: string;
      id?: string;
      is_pro?: boolean;
      plan?: string;
    };
    account_error?: string;
  };
};

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; data: Diag };

export function ImageBackendStatus() {
  const [state, setState] = useState<State>({ status: "loading" });
  const [open, setOpen] = useState(false);

  async function load() {
    setState({ status: "loading" });
    try {
      const res = await fetch("/api/admin/diagnostics/image-backend", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState({ status: "error", message: data?.error ?? `HTTP ${res.status}` });
        return;
      }
      setState({ status: "ok", data });
    } catch (e) {
      setState({ status: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (state.status === "loading") {
    return (
      <div className="mb-3 flex items-center gap-2 rounded-xl border border-black/5 bg-white px-3 py-2 text-xs text-gray-500">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700" />
        Image-backend status laden…
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
        Diagnostiek faalde: {state.message}
        <button
          type="button"
          onClick={load}
          className="ml-2 rounded-full border border-rose-300 bg-white px-2 py-0.5 text-[10px] font-medium hover:bg-rose-50"
        >
          Opnieuw
        </button>
      </div>
    );
  }

  const { data } = state;
  const acct = data.hf.account;
  const tone = computeTone(data);
  const toneClasses = {
    ok: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    bad: "border-rose-200 bg-rose-50 text-rose-900",
  }[tone];
  const Icon = tone === "ok" ? CheckIcon : tone === "warn" ? CameraIcon : XIcon;

  return (
    <div className={`mb-3 rounded-xl border px-3 py-2 text-xs ${toneClasses}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Icon className="h-3.5 w-3.5 flex-none" />
        <span className="font-medium">Image backend:</span>
        <code className="rounded bg-black/5 px-1.5 py-0.5">{data.backend}</code>
        <span>·</span>
        <span className="font-medium">Account:</span>
        {data.hf.token_present ? (
          acct?.name ? (
            <span>
              @{acct.name}
              {acct.is_pro ? (
                <span className="ml-1 rounded-full bg-emerald-200/70 px-1.5 py-0.5 text-[10px] font-semibold">
                  HF Pro · ZeroGPU prio
                </span>
              ) : (
                <span className="ml-1 rounded-full bg-amber-200/70 px-1.5 py-0.5 text-[10px] font-semibold">
                  Free tier
                </span>
              )}
            </span>
          ) : (
            <span>token aanwezig, account-info kon niet opgehaald worden</span>
          )
        ) : (
          <span>
            <span className="font-semibold">anoniem</span> (geen HF_TOKEN — rate-limited, lange cold-starts)
          </span>
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="ml-auto rounded-full border border-black/10 bg-white/70 px-2 py-0.5 text-[10px] font-medium hover:bg-white"
        >
          {open ? "Minder" : "Details"}
        </button>
      </div>

      {open ? (
        <div className="mt-2 space-y-1 border-t border-black/10 pt-2 font-mono text-[10px] leading-relaxed">
          <div>space: {data.hf.space}</div>
          <div>
            token:{" "}
            {data.hf.token_present
              ? data.hf.token_hint ?? "present"
              : "MISSING — set HF_TOKEN in Vercel env vars and redeploy"}
          </div>
          {acct ? (
            <div>
              whoami: name={acct.name ?? "?"} · type={acct.type ?? "?"} · id={acct.id ?? "?"}
              {acct.plan ? ` · plan=${acct.plan}` : ""}
            </div>
          ) : null}
          {data.hf.account_error ? <div>error: {data.hf.account_error}</div> : null}
          {!data.hf.token_present ? (
            <div className="mt-1 text-[10px] not-italic text-amber-900">
              Tip: maak een token op{" "}
              <a
                href="https://huggingface.co/settings/tokens"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                huggingface.co/settings/tokens
              </a>
              , zet hem als <code className="rounded bg-black/5 px-1">HF_TOKEN</code> in Vercel
              project settings → Environment Variables, en redeploy. HF Pro abonnement
              ($9/mnd) geeft ZeroGPU-prioriteit en lost cold-start problemen vrijwel volledig op.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function computeTone(d: Diag): "ok" | "warn" | "bad" {
  if (d.backend === "stub") return "bad";
  if (!d.hf.token_present) return "bad";
  if (d.hf.account_error || !d.hf.account?.name) return "warn";
  return "ok";
}
