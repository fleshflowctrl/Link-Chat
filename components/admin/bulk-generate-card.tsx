"use client";

/**
 * Auto-generate personas card.
 *
 * The actual generation now runs on the server as a chained worker —
 * see /api/admin/personas/batch/start + /tick + the migration
 * 20260516220000_admin_persona_batches.sql for the full architecture.
 *
 * Client responsibilities:
 *   - Validate + collect the operator's brief and options.
 *   - POST /api/admin/personas/batch/start to enqueue.
 *   - Persist the batchId in localStorage so a page refresh / page
 *     leave + return resumes the progress view.
 *   - Poll /api/admin/personas/batch/{id} every couple of seconds for
 *     status until the batch reaches a terminal state.
 *
 * Each persona now completes its FULL pipeline (profile → avatar →
 * gallery photos) before the next persona starts, instead of the old
 * "all profiles first, then all avatars, then all galleries" pattern.
 * That ordering is enforced on the server inside `runOneStep`.
 *
 * The job survives the admin leaving the page: the server worker
 * keeps chaining /tick invocations until every item reaches a terminal
 * state. We just resume the view when the admin returns.
 */

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SparkleIcon, CheckIcon, XIcon, CameraIcon } from "@/components/admin/icons";

type ProfileState = "pending" | "running" | "done" | "error" | "skipped";
type PhotoState = "pending" | "running" | "done" | "error" | "skipped";
type GalleryState =
  | "pending"
  | "running"
  | "partial"
  | "done"
  | "error"
  | "skipped";

type BatchItem = {
  idx: number;
  profile_state: ProfileState;
  photo_state: PhotoState;
  gallery_state: GalleryState;
  gallery_done: number;
  gallery_target: number;
  persona_id: string | null;
  display_name: string | null;
  age: number | null;
  city: string | null;
  occupation: string | null;
  avatar_url: string | null;
  profile_error: string | null;
  photo_error: string | null;
  gallery_error: string | null;
  warning: string | null;
};

type BatchStatus = "pending" | "running" | "done" | "cancelled" | "failed";

type BatchSnapshot = {
  id: string;
  status: BatchStatus;
  total: number;
  brief: string;
  with_photos: boolean;
  gallery_target: number;
  last_error: string | null;
  updated_at: string | null;
  items: BatchItem[];
};

type Attractiveness = "striking" | "average" | "plain";
type BodyType = "slim" | "average" | "plus";

const MAX_BATCH = 10;
const MIN_BRIEF_LEN = 8;
const AGE_FLOOR = 18;
// 80 so seniors stay reachable. The diffusion + Grok pipeline both
// support it; the upper cap is purely a safeguard against typos.
const AGE_CEILING = 80;
const STORAGE_KEY = "admin.bulkGenerate.activeBatchId.v1";
const POLL_INTERVAL_MS = 2500;

const ATTRACTIVENESS_OPTIONS: Array<{
  id: Attractiveness;
  label: string;
  hint: string;
}> = [
  {
    id: "plain",
    label: "Gewoon",
    hint: "onopvallend, niet-perfect — voor balans in de feed",
  },
  {
    id: "average",
    label: "Normaal",
    hint: "alledaagse Nederlandse vrouw — aanbevolen default",
  },
  {
    id: "striking",
    label: "Knap",
    hint: "model-look, fotogeniek — gebruik spaarzaam",
  },
];

const BODY_OPTIONS: Array<{
  id: BodyType;
  label: string;
  hint: string;
}> = [
  { id: "slim", label: "Slank", hint: "smal frame, lean" },
  { id: "average", label: "Normaal", hint: "gemiddelde bouw — default" },
  { id: "plus", label: "Dik", hint: "voller postuur, curvy" },
];

function readStoredBatchId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredBatchId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore quota / private-mode failures
  }
}

export function BulkGenerateCard() {
  const router = useRouter();
  const [count, setCount] = useState(3);
  const [brief, setBrief] = useState("");
  const [withPhotos, setWithPhotos] = useState(true);
  const [attractiveness, setAttractiveness] = useState<Attractiveness>("average");
  const [bodyType, setBodyType] = useState<BodyType>("average");
  // Age inputs are kept as raw strings so the user can type "" → "2" → "25"
  // without the field clamping every keystroke back to AGE_FLOOR. We clamp
  // on blur (so a stray value gets fixed visually) and again at submit
  // time (server also clamps as a defensive measure).
  const [ageMinStr, setAgeMinStr] = useState("22");
  const [ageMaxStr, setAgeMaxStr] = useState("30");

  const [batchId, setBatchId] = useState<string | null>(null);
  const [batch, setBatch] = useState<BatchSnapshot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  // Wallclock of the last time the SERVER reported progress (a change
  // in batch.updated_at). Distinct from "last successful poll" — we
  // want to detect a stalled worker, not a healthy idle polling loop.
  const lastProgressAtRef = useRef<number>(0);
  const lastUpdatedAtRef = useRef<string | null>(null);

  function parseAge(raw: string, fallback: number): number {
    const n = Number(raw);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(AGE_FLOOR, Math.min(AGE_CEILING, Math.round(n)));
  }

  const ageMinNum = parseAge(ageMinStr, 22);
  const ageMaxNum = parseAge(ageMaxStr, 30);

  const fetchBatch = useCallback(async (id: string): Promise<BatchSnapshot | null> => {
    try {
      const res = await fetch(`/api/admin/personas/batch/${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      if (res.status === 404) {
        return null;
      }
      const data: { ok?: boolean; batch?: BatchSnapshot; error?: string } = await res
        .json()
        .catch(() => ({}));
      if (!res.ok || !data.ok || !data.batch) return null;
      return data.batch;
    } catch {
      return null;
    }
  }, []);

  // Fire a single worker tick. Cheap on the server — if the batch is
  // already chained the new tick just hits "waiting" and returns. We
  // use this on page mount and whenever the UI heartbeat fires.
  const kickWorker = useCallback(async (id: string) => {
    try {
      await fetch(`/api/admin/personas/batch/${encodeURIComponent(id)}`, {
        method: "POST",
        cache: "no-store",
      });
    } catch {
      // ignored — next heartbeat retries
    }
  }, []);

  // On mount, check if there's an active batch we should reconnect to.
  // We prefer localStorage (so the operator who started a batch sees it
  // immediately), but fall back to the server's "most recent active"
  // lookup in case they cleared storage or started on a different tab.
  // Whenever we attach to an active batch we IMMEDIATELY prod the
  // worker so a chain that died while the tab was closed resumes
  // before the operator has a chance to think "stuck".
  useEffect(() => {
    let cancelled = false;
    async function discover() {
      const stored = readStoredBatchId();
      if (stored) {
        const snap = await fetchBatch(stored);
        if (cancelled) return;
        if (snap && (snap.status === "pending" || snap.status === "running" || snap.status === "done" || snap.status === "cancelled" || snap.status === "failed")) {
          setBatchId(stored);
          setBatch(snap);
          lastUpdatedAtRef.current = snap.updated_at ?? null;
          lastProgressAtRef.current = Date.now();
          if (snap.status === "pending" || snap.status === "running") {
            void kickWorker(stored);
          }
          // If the operator is returning to a finished batch we still
          // show it (so they can read the summary), but drop the
          // storage pointer so the next visit starts fresh.
          if (snap.status === "done" || snap.status === "cancelled" || snap.status === "failed") {
            writeStoredBatchId(null);
          }
          return;
        }
        writeStoredBatchId(null);
      }
      try {
        const res = await fetch("/api/admin/personas/batch/active", { cache: "no-store" });
        const data: { batch?: { id: string } | null } = await res.json().catch(() => ({}));
        if (cancelled || !data.batch?.id) return;
        const snap = await fetchBatch(data.batch.id);
        if (cancelled || !snap) return;
        setBatchId(data.batch.id);
        setBatch(snap);
        writeStoredBatchId(data.batch.id);
        lastUpdatedAtRef.current = snap.updated_at ?? null;
        lastProgressAtRef.current = Date.now();
        if (snap.status === "pending" || snap.status === "running") {
          void kickWorker(data.batch.id);
        }
      } catch {
        // No active batch — that's fine, show the form.
      }
    }
    discover();
    return () => {
      cancelled = true;
    };
  }, [fetchBatch, kickWorker]);

  // Poll for batch progress while the run is in flight. We refresh the
  // router once when the batch transitions to a terminal state so the
  // personas list below the card picks up the freshly-inserted rows.
  useEffect(() => {
    if (!batchId || !batch) return;
    if (batch.status !== "pending" && batch.status !== "running") return;

    let cancelled = false;
    const tick = async () => {
      const snap = await fetchBatch(batchId);
      if (cancelled) return;
      if (!snap) return;
      setBatch(snap);
      // Only treat this as "progress" if the server's updated_at moved.
      // Without this check, the heartbeat below would never fire because
      // every successful poll would look like fresh activity.
      if (snap.updated_at && snap.updated_at !== lastUpdatedAtRef.current) {
        lastUpdatedAtRef.current = snap.updated_at;
        lastProgressAtRef.current = Date.now();
      }
      if (snap.status === "done" || snap.status === "cancelled" || snap.status === "failed") {
        writeStoredBatchId(null);
        router.refresh();
      }
    };
    const handle = window.setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [batchId, batch, fetchBatch, router]);

  // If the server hasn't reported progress in ~30s, nudge the worker
  // to resume by POSTing to the batch route. 30s is comfortably above
  // a single photo-gen call but tight enough that a dropped chain
  // doesn't sit visibly stuck.
  useEffect(() => {
    if (!batchId || !batch) return;
    if (batch.status !== "pending" && batch.status !== "running") return;
    let cancelled = false;
    const handle = window.setInterval(async () => {
      if (cancelled) return;
      const seenAt = lastProgressAtRef.current;
      const since = seenAt > 0 ? Date.now() - seenAt : 0;
      if (since < 30_000) return;
      await kickWorker(batchId);
      lastProgressAtRef.current = Date.now();
    }, 5_000);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [batchId, batch, kickWorker]);

  async function startBatch() {
    if (submitting) return;
    const trimmedBrief = brief.trim();
    if (trimmedBrief.length < MIN_BRIEF_LEN) {
      setGlobalError(
        `Briefing is te kort (min. ${MIN_BRIEF_LEN} tekens). Beschrijf het type persona in 1-3 zinnen.`,
      );
      return;
    }
    setGlobalError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/personas/batch/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: trimmedBrief,
          count: Math.max(1, Math.min(MAX_BATCH, count)),
          with_photos: withPhotos,
          attractiveness,
          body_type: bodyType,
          age_min: Math.min(ageMinNum, ageMaxNum),
          age_max: Math.max(ageMinNum, ageMaxNum),
        }),
      });
      const data: {
        ok?: boolean;
        batch?: { id: string };
        error?: string;
      } = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok || !data.batch?.id) {
        setGlobalError(data.error ?? `HTTP ${res.status}`);
        setSubmitting(false);
        return;
      }
      const id = data.batch.id;
      writeStoredBatchId(id);
      setBatchId(id);
      const snap = await fetchBatch(id);
      setBatch(snap);
      lastProgressAtRef.current = Date.now();
      lastUpdatedAtRef.current = snap?.updated_at ?? null;
    } catch (e) {
      setGlobalError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelBatch() {
    if (!batchId || cancelling) return;
    setCancelling(true);
    try {
      await fetch(`/api/admin/personas/batch/${encodeURIComponent(batchId)}`, {
        method: "DELETE",
      });
      const snap = await fetchBatch(batchId);
      if (snap) setBatch(snap);
    } catch {
      // ignored — next poll will reflect the state
    } finally {
      setCancelling(false);
    }
  }

  function reset() {
    setBatchId(null);
    setBatch(null);
    setGlobalError(null);
    setBrief("");
    writeStoredBatchId(null);
  }

  const isRunning = batch?.status === "pending" || batch?.status === "running";
  const isTerminal =
    batch?.status === "done" ||
    batch?.status === "cancelled" ||
    batch?.status === "failed";

  if (!batch) {
    return (
      <BulkForm
        count={count}
        brief={brief}
        withPhotos={withPhotos}
        attractiveness={attractiveness}
        bodyType={bodyType}
        ageMinStr={ageMinStr}
        ageMaxStr={ageMaxStr}
        ageMinNum={ageMinNum}
        ageMaxNum={ageMaxNum}
        submitting={submitting}
        globalError={globalError}
        setCount={setCount}
        setBrief={setBrief}
        setWithPhotos={setWithPhotos}
        setAttractiveness={setAttractiveness}
        setBodyType={setBodyType}
        setAgeMinStr={setAgeMinStr}
        setAgeMaxStr={setAgeMaxStr}
        onSubmit={startBatch}
        parseAge={parseAge}
      />
    );
  }

  const items = batch.items;
  const profilesDone = items.filter((i) => i.profile_state === "done").length;
  const profilesError = items.filter((i) => i.profile_state === "error").length;
  const photosDone = items.filter((i) => i.photo_state === "done").length;
  const photosError = items.filter((i) => i.photo_state === "error").length;
  const galleryDoneFull = items.filter((i) => i.gallery_state === "done").length;
  const galleryDonePartial = items.filter((i) => i.gallery_state === "partial").length;
  const galleryError = items.filter((i) => i.gallery_state === "error").length;
  const currentItem = items.find(
    (i) =>
      i.profile_state === "running" ||
      i.photo_state === "running" ||
      i.gallery_state === "running",
  );
  const currentIdx = currentItem?.idx;

  const phaseLabel = (() => {
    if (batch.status === "cancelled") return `Gestopt — ${profilesDone} profielen, ${photosDone} avatars, ${galleryDoneFull}/${profilesDone} volledige galerijen`;
    if (batch.status === "failed") return `Gefaald — ${batch.last_error ?? "onbekende fout"}`;
    if (batch.status === "done") {
      const errs = profilesError + photosError + galleryError;
      return `Klaar — ${profilesDone} profielen, ${photosDone} avatars, ${galleryDoneFull}/${profilesDone} volledige galerijen${
        errs > 0
          ? ` · ${errs} fouten`
          : galleryDonePartial > 0
            ? ` · ${galleryDonePartial} gedeeltelijk`
            : ""
      }`;
    }
    if (currentItem) {
      const personaLabel = currentItem.display_name
        ? `${currentItem.display_name}`
        : `persona #${currentItem.idx + 1}`;
      if (currentItem.profile_state === "running") {
        return `Persona ${currentIdx! + 1}/${batch.total} — profiel schrijven (${personaLabel})…`;
      }
      if (currentItem.photo_state === "running") {
        return `Persona ${currentIdx! + 1}/${batch.total} — avatar renderen (${personaLabel})…`;
      }
      if (currentItem.gallery_state === "running") {
        return `Persona ${currentIdx! + 1}/${batch.total} — galerij ${currentItem.gallery_done + 1}/${batch.gallery_target} (${personaLabel})…`;
      }
    }
    // No item is currently in 'running' state — the chain is either
    // between ticks or the worker died and we're waiting for the next
    // heartbeat to wake it. Find the lowest item that still has any
    // work pending so the operator knows what's queued up.
    const nextPending = items.find(
      (i) =>
        i.profile_state === "pending" ||
        i.photo_state === "pending" ||
        (i.gallery_state !== "done" &&
          i.gallery_state !== "error" &&
          i.gallery_state !== "skipped" &&
          i.gallery_done < batch.gallery_target),
    );
    if (nextPending) {
      const label = nextPending.display_name ?? `persona #${nextPending.idx + 1}`;
      return `Persona ${nextPending.idx + 1}/${batch.total} — wachten op worker (${label})…`;
    }
    return "Klaarzetten…";
  })();

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
            Server-side batch — elke persona doorloopt eerst profiel, dan avatar, dan
            galerij voordat de volgende start. Werkt door zelfs als je weggaat van deze pagina.
          </p>
        </div>
      </div>

      <div className="space-y-4 px-5 py-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900">{phaseLabel}</p>
            <p className="text-[11px] text-gray-500">
              {isRunning
                ? "Je kan deze pagina sluiten — de server gaat door tot alle personas klaar zijn."
                : "Foto- en galerij-fouten zijn niet blokkerend — de persona blijft staan met initialen-avatar."}
            </p>
            {batch.last_error ? (
              <p className="mt-1 truncate text-[11px] text-rose-700">
                Laatste fout: {batch.last_error}
              </p>
            ) : null}
          </div>
          {isRunning ? (
            <button
              type="button"
              onClick={cancelBatch}
              disabled={cancelling}
              className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-60"
            >
              {cancelling ? "Stoppen…" : "Stoppen"}
            </button>
          ) : isTerminal ? (
            <button
              type="button"
              onClick={reset}
              className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:border-gray-500"
            >
              Nieuwe batch
            </button>
          ) : null}
        </div>

        <ul className="space-y-2">
          {items.map((s) => (
            <StepRow key={s.idx} item={s} />
          ))}
        </ul>
      </div>
    </section>
  );
}

function BulkForm(props: {
  count: number;
  brief: string;
  withPhotos: boolean;
  attractiveness: Attractiveness;
  bodyType: BodyType;
  ageMinStr: string;
  ageMaxStr: string;
  ageMinNum: number;
  ageMaxNum: number;
  submitting: boolean;
  globalError: string | null;
  setCount: (n: number) => void;
  setBrief: (s: string) => void;
  setWithPhotos: (b: boolean) => void;
  setAttractiveness: (a: Attractiveness) => void;
  setBodyType: (b: BodyType) => void;
  setAgeMinStr: (s: string) => void;
  setAgeMaxStr: (s: string) => void;
  onSubmit: () => void;
  parseAge: (raw: string, fallback: number) => number;
}) {
  const {
    count,
    brief,
    withPhotos,
    attractiveness,
    bodyType,
    ageMinStr,
    ageMaxStr,
    ageMinNum,
    ageMaxNum,
    submitting,
    globalError,
    setCount,
    setBrief,
    setWithPhotos,
    setAttractiveness,
    setBodyType,
    setAgeMinStr,
    setAgeMaxStr,
    onSubmit,
    parseAge,
  } = props;
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
            Server-side batch — elke persona doorloopt eerst profiel, dan avatar, dan galerij
            voordat de volgende start. Werkt door als je de pagina sluit.
          </p>
        </div>
      </div>

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

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-xl bg-white p-3 ring-1 ring-black/5">
            <p className="mb-2 text-xs font-medium text-gray-700">
              Aantrekkelijkheid <span className="text-gray-400">— alle vrouwen knap = scammy</span>
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {ATTRACTIVENESS_OPTIONS.map((opt) => {
                const active = attractiveness === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setAttractiveness(opt.id)}
                    className={
                      "rounded-lg border px-3 py-2 text-left transition-colors " +
                      (active
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300")
                    }
                  >
                    <div className="text-sm font-semibold">{opt.label}</div>
                    <div className="text-[10px] leading-tight text-gray-500">{opt.hint}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl bg-white p-3 ring-1 ring-black/5">
            <p className="mb-2 text-xs font-medium text-gray-700">
              Lichaamsbouw <span className="text-gray-400">— diversiteit is realisme</span>
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {BODY_OPTIONS.map((opt) => {
                const active = bodyType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setBodyType(opt.id)}
                    className={
                      "rounded-lg border px-3 py-2 text-left transition-colors " +
                      (active
                        ? "border-primary bg-primary/10 text-primary shadow-sm"
                        : "border-gray-200 bg-white text-gray-700 hover:border-gray-300")
                    }
                  >
                    <div className="text-sm font-semibold">{opt.label}</div>
                    <div className="text-[10px] leading-tight text-gray-500">{opt.hint}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-white p-3 ring-1 ring-black/5">
          <p className="mb-2 text-xs font-medium text-gray-700">
            Leeftijdsrange{" "}
            <span className="text-gray-400">
              — server kiest per persona random binnen [{Math.min(ageMinNum, ageMaxNum)}–
              {Math.max(ageMinNum, ageMaxNum)}]
            </span>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-xs text-gray-700">
              <span className="w-12 text-gray-500">Min</span>
              <input
                type="number"
                inputMode="numeric"
                min={AGE_FLOOR}
                max={AGE_CEILING}
                value={ageMinStr}
                onChange={(e) => setAgeMinStr(e.target.value)}
                onBlur={() => setAgeMinStr(String(parseAge(ageMinStr, 22)))}
                className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-700">
              <span className="w-12 text-gray-500">Max</span>
              <input
                type="number"
                inputMode="numeric"
                min={AGE_FLOOR}
                max={AGE_CEILING}
                value={ageMaxStr}
                onChange={(e) => setAgeMaxStr(e.target.value)}
                onBlur={() => setAgeMaxStr(String(parseAge(ageMaxStr, 30)))}
                className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
              />
            </label>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3 ring-1 ring-black/5">
          <label className="flex items-center gap-2 text-xs text-gray-700">
            <input
              type="checkbox"
              checked={withPhotos}
              onChange={(e) => setWithPhotos(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span>
              <span className="font-medium">Echte foto&apos;s genereren met Z-Image-Turbo</span>
              <span className="ml-1 text-gray-500">(avatar + galerij; ~30-90s per foto)</span>
            </span>
          </label>
          <p className="text-[11px] text-gray-500">
            Uit = enkel initialen-avatars. Aan = echte AI-portretten via Hugging Face.
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
            onClick={onSubmit}
            disabled={!brief.trim() || submitting}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-pill transition-transform enabled:hover:scale-[1.02] enabled:hover:bg-primarySoft disabled:cursor-not-allowed disabled:bg-gray-300 disabled:shadow-none"
          >
            <SparkleIcon className="h-4 w-4" />
            {submitting
              ? "Starten…"
              : `Genereer ${count} ${count === 1 ? "persona" : "personas"}`}
          </button>
        </div>
      </div>
    </section>
  );
}

function StepRow({ item }: { item: BatchItem }) {
  const avatar = item.avatar_url ?? "";
  return (
    <li className="flex items-start gap-3 rounded-xl border border-black/5 bg-white px-3 py-2.5">
      {avatar ? (
        <span className="relative h-10 w-10 flex-none overflow-hidden rounded-lg bg-gray-100">
          <Image
            src={avatar}
            alt={item.display_name ?? ""}
            fill
            sizes="40px"
            className="object-cover"
          />
        </span>
      ) : (
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-gray-100">
          <span className="text-[11px] font-semibold text-gray-400">#{item.idx + 1}</span>
        </span>
      )}

      <div className="min-w-0 flex-1">
        {item.display_name ? (
          <p className="truncate text-sm font-medium text-gray-900">
            {item.display_name}
            <span className="ml-1.5 text-xs font-normal text-gray-500">
              {item.age ? `· ${item.age}` : ""}
              {item.city ? `, ${item.city}` : ""}
              {item.occupation ? ` · ${item.occupation}` : ""}
            </span>
          </p>
        ) : item.profile_state === "error" ? (
          <p className="text-sm font-medium text-rose-700">
            Persona #{item.idx + 1} — profiel faalde
          </p>
        ) : item.profile_state === "running" ? (
          <p className="text-sm text-gray-700">
            Persona #{item.idx + 1} — profiel schrijven…
          </p>
        ) : (
          <p className="text-sm text-gray-400">Persona #{item.idx + 1} — wacht</p>
        )}

        {item.persona_id ? (
          <code className="block text-[11px] text-gray-500">{item.persona_id}</code>
        ) : null}

        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
          <Pill
            label="Profiel"
            state={mapState(item.profile_state)}
            errorText={item.profile_error ?? undefined}
          />
          <Pill
            label="Avatar"
            icon="camera"
            state={mapState(item.photo_state)}
            errorText={item.photo_error ?? undefined}
          />
          <Pill
            label={`Galerij ${item.gallery_done}/${item.gallery_target}`}
            icon="camera"
            state={mapGalleryState(item.gallery_state, item.gallery_done > 0)}
            errorText={item.gallery_error ?? undefined}
          />
        </div>

        {item.warning ? (
          <p className="mt-1 text-[11px] text-amber-700">⚠ {item.warning}</p>
        ) : null}
      </div>
    </li>
  );
}

function mapState(
  s: "pending" | "running" | "done" | "error" | "skipped",
): "pending" | "running" | "done" | "error" | "skipped" {
  return s;
}

function mapGalleryState(
  s: "pending" | "running" | "partial" | "done" | "error" | "skipped",
  hasAnySuccess: boolean,
): "pending" | "running" | "done" | "error" | "skipped" {
  // Partial = some photos landed but the batch ran out of retries.
  // Show it as "done" (green) so the operator sees the run finished,
  // and the count label communicates that it's < target.
  if (s === "partial") return hasAnySuccess ? "done" : "error";
  return s;
}

function Pill({
  label,
  icon,
  state,
  errorText,
}: {
  label: string;
  icon?: "camera";
  state: "pending" | "running" | "done" | "error" | "skipped";
  errorText?: string;
}) {
  const cls = {
    pending: "bg-gray-100 text-gray-500 ring-gray-200",
    running: "bg-violet-50 text-violet-700 ring-violet-200",
    done: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    error: "bg-rose-50 text-rose-700 ring-rose-200",
    skipped: "bg-gray-50 text-gray-400 ring-gray-200",
  }[state];
  const tip = state === "error" && errorText ? errorText : undefined;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ring-1 ring-inset ${cls}`}
      title={tip}
    >
      {icon === "camera" ? <CameraIcon className="h-3 w-3" /> : null}
      {state === "running" ? (
        <span className="h-2 w-2 animate-spin rounded-full border-[1.5px] border-current border-r-transparent" />
      ) : state === "done" ? (
        <CheckIcon className="h-2.5 w-2.5" />
      ) : state === "error" ? (
        <XIcon className="h-2.5 w-2.5" />
      ) : null}
      <span>{label}</span>
      {state === "error" && errorText ? (
        <span className="ml-1 max-w-[160px] truncate text-[10px] opacity-80">
          · {errorText.slice(0, 60)}
        </span>
      ) : null}
    </span>
  );
}
