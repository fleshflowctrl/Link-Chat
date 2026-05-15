"use client";

/**
 * Auto-generate personas card.
 *
 * The operator types a count + a one-paragraph brief and clicks Generate.
 * We then loop the count, calling /api/admin/personas/generate-one once
 * per persona. Each call is independent so a single Vercel timeout
 * doesn't kill the whole batch — and we render per-persona progress as
 * we go.
 *
 * Variation in a batch:
 *   - The brief is reused verbatim, but `index`/`total`/`exclude` are
 *     forwarded so Grok knows it should make this persona distinct from
 *     the ones already produced.
 *   - We push every successful id + display_name onto `exclude` before
 *     the next call, so the model can't repeat names.
 *
 * UX:
 *   - The card stays mounted while running, with a per-persona checklist.
 *   - When done, "Nieuwe batch" resets the form. The personas list is
 *     refreshed via router.refresh() so newly-created personas appear
 *     in the grid below.
 *   - Cancel uses a ref-flag (state would lag a render behind), so the
 *     loop stops between calls instead of mid-API-request.
 */

import Image from "next/image";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SparkleIcon, CheckIcon, XIcon } from "@/components/admin/icons";

type StepState = "pending" | "running" | "done" | "error";
type StepResult = {
  id: string;
  display_name: string;
  age: number;
  city: string;
  occupation: string | null;
  avatar_url: string;
};
type Step = {
  index: number;
  state: StepState;
  result?: StepResult;
  error?: string;
  warning?: string;
};
type Phase = "idle" | "running" | "done";

const MAX_BATCH = 10;
const MIN_BRIEF_LEN = 8;

export function BulkGenerateCard() {
  const router = useRouter();
  const [count, setCount] = useState(3);
  const [brief, setBrief] = useState("");
  const [withAvatar, setWithAvatar] = useState(true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [steps, setSteps] = useState<Step[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Cancel-flag must be a ref — state updates batch and the loop reads
  // them between awaits, so a state-based abort would lag.
  const abortRef = useRef(false);

  function updateStep(index: number, patch: Partial<Step>) {
    setSteps((arr) =>
      arr.map((s) => (s.index === index ? { ...s, ...patch } : s)),
    );
  }

  async function startBatch() {
    if (phase === "running") return;
    const trimmedBrief = brief.trim();
    if (trimmedBrief.length < MIN_BRIEF_LEN) {
      setGlobalError(
        `Briefing is te kort (min. ${MIN_BRIEF_LEN} tekens). Beschrijf het type persona in 1-3 zinnen.`,
      );
      return;
    }
    setGlobalError(null);
    abortRef.current = false;

    const total = Math.max(1, Math.min(MAX_BATCH, count));
    const initial: Step[] = Array.from({ length: total }, (_, i) => ({
      index: i,
      state: "pending",
    }));
    setSteps(initial);
    setPhase("running");

    const exclude: string[] = [];

    for (let i = 0; i < total; i++) {
      if (abortRef.current) {
        // Mark all remaining as cancelled-error so the user sees the abort.
        setSteps((arr) =>
          arr.map((s) =>
            s.state === "pending" ? { ...s, state: "error", error: "Geannuleerd" } : s,
          ),
        );
        break;
      }

      updateStep(i, { state: "running" });
      try {
        const res = await fetch("/api/admin/personas/generate-one", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brief: trimmedBrief,
            index: i,
            total,
            exclude,
            with_avatar: withAvatar,
          }),
        });
        const data: {
          ok?: boolean;
          persona?: StepResult;
          error?: string;
          warning?: string | null;
        } = await res.json().catch(() => ({}));

        if (!res.ok || !data.ok || !data.persona) {
          updateStep(i, {
            state: "error",
            error: data.error ?? `HTTP ${res.status}`,
          });
          continue;
        }

        updateStep(i, {
          state: "done",
          result: data.persona,
          warning: data.warning ?? undefined,
        });
        exclude.push(data.persona.id);
        exclude.push(data.persona.display_name);
      } catch (e) {
        updateStep(i, {
          state: "error",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    setPhase("done");
    // Refresh the page so newly-inserted personas show in the list below.
    router.refresh();
  }

  function reset() {
    setPhase("idle");
    setSteps([]);
    setGlobalError(null);
    setBrief("");
  }

  function cancel() {
    abortRef.current = true;
  }

  const doneCount = steps.filter((s) => s.state === "done").length;
  const errorCount = steps.filter((s) => s.state === "error").length;

  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-black/5 bg-gradient-to-br from-white via-lavender/30 to-white shadow-sm">
      <div className="flex items-start gap-3 border-b border-black/5 bg-white/60 px-5 py-4 backdrop-blur">
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-primary/10 text-primary">
          <SparkleIcon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-semibold text-gray-900">
            Auto-genereer personas met AI
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Geef het aantal en een korte briefing — Grok schrijft de complete profielen
            (identiteit, bio, persona-meta, chatstijl), en Z-Image-Turbo maakt automatisch
            een avatar voor elke persona.
          </p>
        </div>
      </div>

      {phase === "idle" ? (
        <div className="space-y-4 px-5 py-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[160px,1fr]">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-700">
                Aantal personas
              </label>
              <input
                type="number"
                min={1}
                max={MAX_BATCH}
                value={count}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n)) {
                    setCount(Math.max(1, Math.min(MAX_BATCH, Math.round(n))));
                  }
                }}
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
              <p className="mt-1 text-[11px] text-gray-400">Max {MAX_BATCH} per batch.</p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-700">
                Briefing (type persona)
              </label>
              <textarea
                rows={3}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder='Bv: "studentes 22-26 uit de Randstad, mix soft-girl en speels, hobby-mix tussen yoga, koffie en feestjes"'
                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
              <p className="mt-1 text-[11px] text-gray-400">
                Hoe specifieker, hoe meer karakter. Houd het wel onder 3-4 zinnen.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3 ring-1 ring-black/5">
            <label className="flex items-center gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={withAvatar}
                onChange={(e) => setWithAvatar(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span>
                <span className="font-medium">Avatar mee-genereren</span>
                <span className="ml-1 text-gray-500">(Z-Image-Turbo, ~15-30s per persona)</span>
              </span>
            </label>
            <p className="text-[11px] text-gray-500">
              Zonder avatar gaat het sneller, maar moet je ze later handmatig uploaden.
            </p>
          </div>

          {globalError ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {globalError}
            </div>
          ) : null}

          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={startBatch}
              disabled={!brief.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-pill transition-transform enabled:hover:scale-[1.02] enabled:hover:bg-primarySoft disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none"
            >
              <SparkleIcon className="h-4 w-4" />
              Genereer {count} {count === 1 ? "persona" : "personas"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4 px-5 py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">
                {phase === "running"
                  ? `Bezig… ${doneCount}/${steps.length} klaar${errorCount > 0 ? ` · ${errorCount} fout` : ""}`
                  : `Klaar — ${doneCount} toegevoegd${errorCount > 0 ? `, ${errorCount} fout` : ""}`}
              </p>
              <p className="text-[11px] text-gray-500">
                Personas worden direct opgeslagen in <code className="rounded bg-gray-100 px-1">chat_profiles</code>.
              </p>
            </div>
            {phase === "running" ? (
              <button
                type="button"
                onClick={cancel}
                className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
              >
                Stoppen
              </button>
            ) : (
              <button
                type="button"
                onClick={reset}
                className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:border-gray-500"
              >
                Nieuwe batch
              </button>
            )}
          </div>

          <ul className="space-y-2">
            {steps.map((s) => (
              <StepRow key={s.index} step={s} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function StepRow({ step }: { step: Step }) {
  return (
    <li className="flex items-start gap-3 rounded-xl border border-black/5 bg-white px-3 py-2.5">
      <StepIcon state={step.state} />
      <div className="min-w-0 flex-1">
        {step.state === "done" && step.result ? (
          <div className="flex items-center gap-3">
            {step.result.avatar_url ? (
              <span className="relative h-9 w-9 flex-none overflow-hidden rounded-lg bg-gray-100">
                <Image
                  src={step.result.avatar_url}
                  alt={step.result.display_name}
                  fill
                  sizes="36px"
                  className="object-cover"
                />
              </span>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900">
                {step.result.display_name}
                <span className="ml-1.5 text-xs font-normal text-gray-500">
                  · {step.result.age}, {step.result.city}
                  {step.result.occupation ? ` · ${step.result.occupation}` : ""}
                </span>
              </p>
              <code className="text-[11px] text-gray-500">{step.result.id}</code>
              {step.warning ? (
                <p className="mt-0.5 text-[11px] text-amber-700">⚠ {step.warning}</p>
              ) : null}
            </div>
          </div>
        ) : step.state === "error" ? (
          <div className="min-w-0">
            <p className="text-sm font-medium text-rose-700">
              Persona #{step.index + 1} — fout
            </p>
            <p className="mt-0.5 truncate text-xs text-rose-600">
              {step.error || "Onbekende fout"}
            </p>
          </div>
        ) : step.state === "running" ? (
          <p className="text-sm text-gray-700">
            Persona #{step.index + 1} — Grok schrijft profiel + avatar genereren…
          </p>
        ) : (
          <p className="text-sm text-gray-400">Persona #{step.index + 1} — wacht</p>
        )}
      </div>
    </li>
  );
}

function StepIcon({ state }: { state: StepState }) {
  if (state === "done") {
    return (
      <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <CheckIcon className="h-3 w-3" />
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-rose-100 text-rose-700">
        <XIcon className="h-3 w-3" />
      </span>
    );
  }
  if (state === "running") {
    return (
      <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
      </span>
    );
  }
  return (
    <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center">
      <span className="h-2 w-2 rounded-full bg-gray-300" />
    </span>
  );
}
