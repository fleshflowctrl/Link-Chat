/**
 * Persona-batch shared utilities.
 *
 * Used by:
 *   /api/admin/personas/batch/start      — create rows + kick off worker
 *   /api/admin/personas/batch/tick       — process one unit, chain the next
 *   /api/admin/personas/batch/[id]       — GET status / DELETE = cancel
 *
 * The worker is a self-chaining function: each /tick invocation picks
 * the first item with pending work, processes ONE unit (write profile,
 * regen avatar, or append one gallery photo), updates state, then fires
 * off the next /tick via fetch before returning. That keeps every step
 * inside Vercel's 60s function budget while allowing batches of any
 * realistic size to complete without the client.
 *
 * Worker authentication: we don't have a user session inside the chained
 * fetch, so the tick endpoint accepts an HMAC token derived from
 * SUPABASE_SERVICE_ROLE_KEY + the batchId. Anyone who can compute the
 * token already has the service key (and therefore full DB access), so
 * this is a defensive boundary, not a security primary.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  appendPersonaGalleryPhoto,
  createPersonaFromBrief,
  regeneratePersonaAvatar,
  type Attractiveness,
  type BodyType,
} from "@/lib/admin/persona-ops";

/** Hand a fire-and-forget promise to Vercel's runtime so it stays
 * alive long enough for the I/O to complete after our handler has
 * returned its response. Locally (next dev) we just await the
 * promise inline because there's no risk of the function getting
 * frozen mid-flight. */
async function vercelWaitUntil(p: Promise<unknown>): Promise<void> {
  // `process.env.VERCEL` is set on every Vercel deployment (preview +
  // production). Outside that, `@vercel/functions`'s waitUntil throws
  // because there's no request context — so we hard-gate on the env.
  if (process.env.VERCEL) {
    try {
      const mod = await import("@vercel/functions");
      if (typeof mod.waitUntil === "function") {
        mod.waitUntil(p);
        return;
      }
    } catch {
      // ignore — fall through to inline await
    }
  }
  // Local dev / non-Vercel host: just wait for the fetch to round-trip.
  // The trigger fetch returns quickly (the new tick endpoint validates
  // its token, schedules the work, and responds in <100ms).
  await p.catch(() => undefined);
}

/** Schedule arbitrary async work to run AFTER the current route
 * handler has returned its response. On Vercel this extends the
 * function lifetime via `waitUntil`; locally we await inline. Use
 * this when the handler should ack fast but still complete real
 * work before the function instance exits. */
export async function scheduleAfterResponse(
  fn: () => Promise<unknown>,
): Promise<void> {
  const p = (async () => {
    try {
      await fn();
    } catch (err) {
      console.error("[persona-batch:scheduleAfterResponse]", err);
    }
  })();
  await vercelWaitUntil(p);
}

/** Items stuck in `*_state='running'` longer than this are assumed to
 * have been orphaned by a crashed tick and get reset to 'pending' on
 * the next tick. Must stay above {@link PHOTO_TIMEOUT_MS} /
 * {@link PROFILE_TIMEOUT_MS} so we don't reset while work is still
 * in-flight — but lower than the old 90s so a dropped chain recovers
 * faster. */
const STUCK_THRESHOLD_MS = 58 * 1000;

function log(scope: string, msg: string, extra?: Record<string, unknown>) {
  // Persona-batch worker is hard to debug without per-step logs because
  // each tick is a separate function invocation. Keep these short so the
  // platform log isn't flooded.
  console.log(`[persona-batch:${scope}] ${msg}`, extra ?? {});
}

/** Soft-timeout for one diffusion call — must finish before Vercel's
 * 60s cap so we can write DB state and chain the next tick. */
const PHOTO_TIMEOUT_MS = 42 * 1000;

/** Grok profile generation can hang; bound it so the batch never sits
 * on `profile_state=running` until the stuck watchdog fires. */
const PROFILE_TIMEOUT_MS = 40 * 1000;

/** When a tick sees in-flight work (`waiting`), schedule another tick
 * after this delay so a dropped chain self-heals without waiting for
 * cron / the UI heartbeat. */
const WAITING_RETRY_MS = 12 * 1000;

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutValue: T,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(timeoutValue), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export type BatchRow = {
  id: string;
  owner_user_id: string;
  status: "pending" | "running" | "done" | "cancelled" | "failed";
  brief: string;
  total: number;
  with_photos: boolean;
  attractiveness: Attractiveness;
  body_type: BodyType;
  age_min: number;
  age_max: number;
  gallery_target: number;
  scene_offset: number;
  exclude_ids: string[];
  exclude_names: string[];
  last_error: string | null;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
};

export type BatchItemRow = {
  batch_id: string;
  idx: number;
  profile_state: "pending" | "running" | "done" | "error" | "skipped";
  photo_state: "pending" | "running" | "done" | "error" | "skipped";
  gallery_state:
    | "pending"
    | "running"
    | "done"
    | "partial"
    | "error"
    | "skipped";
  gallery_done: number;
  gallery_attempts: number;
  persona_id: string | null;
  display_name: string | null;
  age: number | null;
  city: string | null;
  occupation: string | null;
  avatar_url: string | null;
  real_avatar_url: string | null;
  profile_error: string | null;
  photo_error: string | null;
  gallery_error: string | null;
  warning: string | null;
  claimed_at: string | null;
  created_at: string;
  updated_at: string;
};

/** HMAC the tick endpoint uses to authenticate a chained worker call.
 * Deterministic per batchId so a retried tick still works without
 * persisting the token anywhere. */
export function workerToken(batchId: string): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createHmac("sha256", key).update(`persona-batch:${batchId}`).digest("hex");
}

/** Constant-time compare so attackers can't time-out the token. */
export function verifyWorkerToken(batchId: string, candidate: string): boolean {
  if (typeof candidate !== "string" || candidate.length !== 64) return false;
  const expected = workerToken(batchId);
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(candidate, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Best-effort absolute base URL for chaining worker fetches. We try
 * env vars first (set on Vercel) and fall back to the inbound request's
 * origin if available. The first chain call inside `start` happens
 * during a real request so the origin fallback is reliable. */
export function resolveBaseUrl(req?: Request): string {
  const explicit = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    ""
  )
    .trim()
    .replace(/\/+$/, "");
  if (explicit) {
    return explicit.startsWith("http") ? explicit : `https://${explicit}`;
  }
  if (req) {
    try {
      const u = new URL(req.url);
      return `${u.protocol}//${u.host}`;
    } catch {
      // ignored
    }
    const forwardedHost = req.headers.get("x-forwarded-host");
    const forwardedProto = req.headers.get("x-forwarded-proto") ?? "https";
    if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;
    const host = req.headers.get("host");
    if (host) return `http://${host}`;
  }
  return "http://localhost:3000";
}

/** Kick off the next worker tick. The destination route acks fast
 * (the work runs in its own waitUntil) so awaiting this fetch only
 * blocks for ~100ms even when the chain is busy. We add a 25s
 * timeout as a safety net — if the new invocation can't even
 * acknowledge in that window something is seriously wrong (cold
 * start way out of band, network down), and the cron + UI heartbeat
 * will retry. */
export async function triggerNextTick(
  baseUrl: string,
  batchId: string,
): Promise<void> {
  const url = `${baseUrl}/api/admin/personas/batch/tick`;
  const token = workerToken(batchId);
  const body = JSON.stringify({ batchId, token });

  log("triggerNextTick", "fire", { batchId, url });

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 25_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      cache: "no-store",
      signal: controller.signal,
    });
    log("triggerNextTick", "ack", { batchId, status: res.status });
  } catch (err) {
    log("triggerNextTick", "error", {
      batchId,
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    clearTimeout(t);
  }
}

async function loadBatch(
  service: SupabaseClient,
  batchId: string,
): Promise<BatchRow | null> {
  const { data, error } = await service
    .from("chat_persona_batches")
    .select("*")
    .eq("id", batchId)
    .maybeSingle();
  if (error || !data) return null;
  return data as BatchRow;
}

async function loadItems(
  service: SupabaseClient,
  batchId: string,
): Promise<BatchItemRow[]> {
  const { data } = await service
    .from("chat_persona_batch_items")
    .select("*")
    .eq("batch_id", batchId)
    .order("idx", { ascending: true });
  return (data ?? []) as BatchItemRow[];
}

async function patchItem(
  service: SupabaseClient,
  batchId: string,
  idx: number,
  patch: Partial<BatchItemRow>,
): Promise<void> {
  const { error } = await service
    .from("chat_persona_batch_items")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("batch_id", batchId)
    .eq("idx", idx);
  if (error) {
    // Surface DB errors so the operator can spot e.g. a missing column
    // from an un-applied migration. Without this the worker silently
    // fails to write and the item appears stuck.
    log("patchItem-error", error.message, { batchId, idx, patch });
  }
}

async function patchBatch(
  service: SupabaseClient,
  batchId: string,
  patch: Partial<BatchRow>,
): Promise<void> {
  const { error } = await service
    .from("chat_persona_batches")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", batchId);
  if (error) {
    log("patchBatch-error", error.message, { batchId, patch });
  }
}

/** Reset any items whose claimed_at is older than STUCK_THRESHOLD_MS.
 * The worker is single-stream per batch but a crashed/timed-out tick
 * can leave an item half-running; recovering it lets the next tick
 * make progress instead of getting stuck on the row forever.
 *
 * Gallery recovery also bumps `gallery_attempts` (and on the final
 * attempt flips the state to partial/error). Without this the worker
 * would retry the exact same variant — same scene + same seed — every
 * single recovery cycle and a flaky HF Space would loop forever.
 */
async function recoverStuckItems(
  service: SupabaseClient,
  batchId: string,
  galleryTarget: number,
  now: number,
): Promise<void> {
  const cutoff = new Date(now - STUCK_THRESHOLD_MS).toISOString();
  const { data: stuck } = await service
    .from("chat_persona_batch_items")
    .select(
      "idx, profile_state, photo_state, gallery_state, gallery_attempts, gallery_done, claimed_at",
    )
    .eq("batch_id", batchId)
    .lt("claimed_at", cutoff)
    .or(
      "profile_state.eq.running,photo_state.eq.running,gallery_state.eq.running",
    );
  let recovered = 0;
  for (const row of (stuck ?? []) as Array<
    Pick<
      BatchItemRow,
      | "idx"
      | "profile_state"
      | "photo_state"
      | "gallery_state"
      | "gallery_attempts"
      | "gallery_done"
      | "claimed_at"
    >
  >) {
    const patch: Partial<BatchItemRow> = { claimed_at: null };
    if (row.profile_state === "running") patch.profile_state = "pending";
    if (row.photo_state === "running") patch.photo_state = "pending";
    if (row.gallery_state === "running") {
      const attempts = row.gallery_attempts + 1;
      const exhausted = attempts >= galleryTarget;
      patch.gallery_attempts = attempts;
      patch.gallery_state = exhausted
        ? row.gallery_done > 0
          ? "partial"
          : "error"
        : "pending";
      patch.gallery_error = `Stuck recovered (>${Math.round(STUCK_THRESHOLD_MS / 1000)}s)`;
    }
    log("recover", "reset", { batchId, idx: row.idx, patch });
    await patchItem(service, batchId, row.idx, patch);
    recovered += 1;
  }
  if (recovered > 0) {
    await patchBatch(service, batchId, { updated_at: new Date().toISOString() });
  }

  // `running` without `claimed_at` means a tick crashed between the state
  // flip and the claim write — those rows never match the cutoff query.
  const { data: orphanRunning } = await service
    .from("chat_persona_batch_items")
    .select(
      "idx, profile_state, photo_state, gallery_state, gallery_attempts, gallery_done",
    )
    .eq("batch_id", batchId)
    .is("claimed_at", null)
    .or(
      "profile_state.eq.running,photo_state.eq.running,gallery_state.eq.running",
    );
  for (const row of (orphanRunning ?? []) as Array<
    Pick<
      BatchItemRow,
      | "idx"
      | "profile_state"
      | "photo_state"
      | "gallery_state"
      | "gallery_attempts"
      | "gallery_done"
    >
  >) {
    const patch: Partial<BatchItemRow> = { claimed_at: null };
    if (row.profile_state === "running") patch.profile_state = "pending";
    if (row.photo_state === "running") patch.photo_state = "pending";
    if (row.gallery_state === "running") {
      const attempts = row.gallery_attempts + 1;
      const exhausted = attempts >= galleryTarget;
      patch.gallery_attempts = attempts;
      patch.gallery_state = exhausted
        ? row.gallery_done > 0
          ? "partial"
          : "error"
        : "pending";
      patch.gallery_error = "Orphaned running state (geen claimed_at)";
    }
    log("recover", "orphan", { batchId, idx: row.idx, patch });
    await patchItem(service, batchId, row.idx, patch);
    await patchBatch(service, batchId, { updated_at: new Date().toISOString() });
  }
}

/** Re-queue the worker while another unit is still marked running
 * (e.g. a previous tick died mid-photo). Idempotent — a busy tick just
 * returns `waiting` again. */
export async function scheduleWaitingResume(
  baseUrl: string,
  batchId: string,
  service: SupabaseClient,
): Promise<void> {
  await new Promise((r) => setTimeout(r, WAITING_RETRY_MS));
  const batch = await loadBatch(service, batchId);
  if (
    !batch ||
    batch.status === "done" ||
    batch.status === "cancelled" ||
    batch.status === "failed"
  ) {
    return;
  }
  await triggerNextTick(baseUrl, batchId);
}

type NextUnit =
  | { kind: "profile"; item: BatchItemRow }
  | { kind: "avatar"; item: BatchItemRow }
  | { kind: "gallery"; item: BatchItemRow; variant: number }
  | { kind: "wait"; reason: string }
  | { kind: "none" };

/** Find the next work unit. The operator's expectation is
 *   "first finish persona 0, THEN persona 1, THEN persona 2",
 * so as long as ANY phase of an earlier persona is still in flight we
 * refuse to start work on a later persona — even if that later persona
 * is fully pending. The tick handler treats `wait` as "back off until
 * a watchdog wakes us up" so we don't busy-loop while a tick that's
 * still mid-call (e.g. waiting on the HF Space) finishes.
 *
 * Recovery in runOneStep resets items that have been stuck longer than
 * STUCK_THRESHOLD_MS, so a crashed-mid-work tick can't block the batch
 * forever — at worst we pause ~58s.
 */
function pickNextUnit(batch: BatchRow, items: BatchItemRow[]): NextUnit {
  for (const item of items) {
    // Profile phase.
    if (item.profile_state === "running") {
      return { kind: "wait", reason: `item ${item.idx} profile running` };
    }
    if (item.profile_state === "pending") {
      return { kind: "profile", item };
    }
    if (item.profile_state !== "done") {
      // 'error' / 'skipped' — this row is done with work, move on.
      continue;
    }
    if (!batch.with_photos) continue;

    // Avatar phase.
    if (item.photo_state === "running") {
      return { kind: "wait", reason: `item ${item.idx} avatar running` };
    }
    if (item.photo_state === "pending") {
      return { kind: "avatar", item };
    }
    // photo done/error/skipped — gallery proceeds either way.

    // Gallery phase.
    if (item.gallery_state === "running") {
      return { kind: "wait", reason: `item ${item.idx} gallery running` };
    }
    if (
      item.gallery_state !== "done" &&
      item.gallery_state !== "error" &&
      item.gallery_state !== "skipped" &&
      item.gallery_attempts < batch.gallery_target
    ) {
      // Variant follows the attempt counter so successive tries roll
      // different scene templates (matching the legacy client loop).
      const variant =
        batch.scene_offset +
        item.idx * batch.gallery_target +
        item.gallery_attempts;
      return { kind: "gallery", item, variant };
    }
    // gallery exhausted/done/error — this row is finished, move on.
  }
  return { kind: "none" };
}

export type RunOneStepResult =
  | { kind: "worked"; moreWork: boolean }
  | { kind: "waiting"; reason: string }
  | { kind: "missing-batch" }
  | { kind: "stopped"; reason: "cancelled" | "done" | "failed" };

/** Process exactly one unit of work for a batch. Caller is responsible
 * for triggering the next tick when `moreWork === true`, or calling
 * {@link scheduleWaitingResume} when the result is `waiting`. */
export async function runOneStep(
  service: SupabaseClient,
  batchId: string,
): Promise<RunOneStepResult> {
  const batch = await loadBatch(service, batchId);
  if (!batch) {
    log("runOneStep", "missing batch", { batchId });
    return { kind: "missing-batch" };
  }
  if (batch.status === "cancelled") return { kind: "stopped", reason: "cancelled" };
  if (batch.status === "done") return { kind: "stopped", reason: "done" };
  if (batch.status === "failed") return { kind: "stopped", reason: "failed" };

  const now = Date.now();
  await recoverStuckItems(service, batchId, batch.gallery_target, now);

  if (batch.status === "pending") {
    await patchBatch(service, batchId, { status: "running" });
  }

  const items = await loadItems(service, batchId);
  const next = pickNextUnit(batch, items);
  log("pickNextUnit", next.kind, { batchId, idx: next.kind === "profile" || next.kind === "avatar" || next.kind === "gallery" ? next.item.idx : undefined });

  if (next.kind === "wait") {
    return { kind: "waiting", reason: next.reason };
  }

  if (next.kind === "none") {
    await patchBatch(service, batchId, {
      status: "done",
      finished_at: new Date().toISOString(),
    });
    log("runOneStep", "marked done", { batchId });
    return { kind: "stopped", reason: "done" };
  }

  const nowIso = new Date().toISOString();

  if (next.kind === "profile") {
    log("profile", "start", { batchId, idx: next.item.idx });
    await patchItem(service, batchId, next.item.idx, {
      profile_state: "running",
      claimed_at: nowIso,
      profile_error: null,
    });
    try {
      const result = await withTimeout(
        createPersonaFromBrief(service, {
          brief: batch.brief,
          index: next.item.idx,
          total: batch.total,
          exclude: [...batch.exclude_ids, ...batch.exclude_names].slice(0, 24),
          attractiveness: batch.attractiveness,
          body_type: batch.body_type,
          age_min: batch.age_min,
          age_max: batch.age_max,
        }),
        PROFILE_TIMEOUT_MS,
        {
          ok: false as const,
          error: `Profielgeneratie timeout (>${Math.round(PROFILE_TIMEOUT_MS / 1000)}s)`,
          status: 504,
        },
      );
      if (!result.ok) {
        log("profile", "fail", { batchId, idx: next.item.idx, error: result.error });
        await patchItem(service, batchId, next.item.idx, {
          profile_state: "error",
          photo_state: "skipped",
          gallery_state: "skipped",
          profile_error: result.error,
          claimed_at: null,
        });
        await patchBatch(service, batchId, { last_error: result.error });
        return { kind: "worked", moreWork: true };
      }
      log("profile", "done", { batchId, idx: next.item.idx, persona_id: result.persona.id });
      await patchItem(service, batchId, next.item.idx, {
        profile_state: "done",
        persona_id: result.persona.id,
        display_name: result.persona.display_name,
        age: result.persona.age,
        city: result.persona.city,
        occupation: result.persona.occupation,
        avatar_url: result.persona.avatar_url,
        warning: result.warning,
        claimed_at: null,
        // If the operator turned off photos, mark the later phases as
        // skipped now so the batch can finish without revisiting them.
        ...(batch.with_photos
          ? null
          : { photo_state: "skipped", gallery_state: "skipped" }),
      });
      await patchBatch(service, batchId, {
        exclude_ids: [...batch.exclude_ids, result.persona.id].slice(-24),
        exclude_names: [...batch.exclude_names, result.persona.display_name].slice(-24),
        last_error: null,
      });
      return { kind: "worked", moreWork: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log("profile", "throw", { batchId, idx: next.item.idx, error: msg });
      await patchItem(service, batchId, next.item.idx, {
        profile_state: "error",
        photo_state: "skipped",
        gallery_state: "skipped",
        profile_error: msg,
        claimed_at: null,
      });
      await patchBatch(service, batchId, { last_error: msg });
      return { kind: "worked", moreWork: true };
    }
  }

  if (next.kind === "avatar") {
    if (!next.item.persona_id) {
      // Defensive — shouldn't happen because profile_state=done implies
      // we wrote persona_id. Skip phase 2 so the batch can move on.
      await patchItem(service, batchId, next.item.idx, {
        photo_state: "skipped",
        photo_error: "persona_id ontbreekt op item",
      });
      return { kind: "worked", moreWork: true };
    }
    log("avatar", "start", { batchId, idx: next.item.idx, persona_id: next.item.persona_id });
    await patchItem(service, batchId, next.item.idx, {
      photo_state: "running",
      claimed_at: nowIso,
      photo_error: null,
    });
    try {
      const result = await withTimeout(
        regeneratePersonaAvatar(service, {
          personaId: next.item.persona_id,
          variant: batch.scene_offset + next.item.idx,
        }),
        PHOTO_TIMEOUT_MS,
        {
          ok: false as const,
          error: `Avatar-generatie timeout (>${Math.round(PHOTO_TIMEOUT_MS / 1000)}s)`,
          status: 504,
        },
      );
      if (!result.ok) {
        log("avatar", "fail", { batchId, idx: next.item.idx, error: result.error });
        await patchItem(service, batchId, next.item.idx, {
          photo_state: "error",
          photo_error: result.error,
          claimed_at: null,
        });
        await patchBatch(service, batchId, { last_error: result.error });
        return { kind: "worked", moreWork: true };
      }
      log("avatar", "done", { batchId, idx: next.item.idx });
      await patchItem(service, batchId, next.item.idx, {
        photo_state: "done",
        real_avatar_url: result.avatar_url,
        avatar_url: result.avatar_url,
        claimed_at: null,
      });
      await patchBatch(service, batchId, { last_error: null });
      return { kind: "worked", moreWork: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log("avatar", "throw", { batchId, idx: next.item.idx, error: msg });
      await patchItem(service, batchId, next.item.idx, {
        photo_state: "error",
        photo_error: msg,
        claimed_at: null,
      });
      await patchBatch(service, batchId, { last_error: msg });
      return { kind: "worked", moreWork: true };
    }
  }

  // gallery
  if (!next.item.persona_id) {
    await patchItem(service, batchId, next.item.idx, {
      gallery_state: "skipped",
      gallery_error: "persona_id ontbreekt op item",
    });
    return { kind: "worked", moreWork: true };
  }
  log("gallery", "start", {
    batchId,
    idx: next.item.idx,
    attempt: next.item.gallery_attempts + 1,
    target: batch.gallery_target,
    variant: next.variant,
  });
  await patchItem(service, batchId, next.item.idx, {
    gallery_state: "running",
    claimed_at: nowIso,
    gallery_error: null,
  });
  try {
    const result = await withTimeout(
      appendPersonaGalleryPhoto(service, {
        personaId: next.item.persona_id,
        variant: next.variant,
      }),
      PHOTO_TIMEOUT_MS,
      {
        ok: false as const,
        error: `Gallery-generatie timeout (>${Math.round(PHOTO_TIMEOUT_MS / 1000)}s)`,
        status: 504,
      },
    );
    const attempts = next.item.gallery_attempts + 1;
    const successes = next.item.gallery_done + (result.ok ? 1 : 0);
    const exhausted = attempts >= batch.gallery_target;
    const stateAfter: BatchItemRow["gallery_state"] = exhausted
      ? successes >= batch.gallery_target
        ? "done"
        : successes > 0
          ? "partial"
          : "error"
      : "pending";
    log("gallery", result.ok ? "ok" : "fail", {
      batchId,
      idx: next.item.idx,
      attempts,
      successes,
      stateAfter,
      error: result.ok ? null : result.error,
    });
    await patchItem(service, batchId, next.item.idx, {
      gallery_attempts: attempts,
      gallery_done: successes,
      gallery_state: stateAfter,
      gallery_error: result.ok ? null : result.error,
      claimed_at: null,
    });
    await patchBatch(service, batchId, {
      last_error: result.ok ? null : result.error,
    });
    return { kind: "worked", moreWork: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const attempts = next.item.gallery_attempts + 1;
    const exhausted = attempts >= batch.gallery_target;
    const stateAfter: BatchItemRow["gallery_state"] = exhausted
      ? next.item.gallery_done > 0
        ? "partial"
        : "error"
      : "pending";
    log("gallery", "throw", {
      batchId,
      idx: next.item.idx,
      attempts,
      stateAfter,
      error: msg,
    });
    await patchItem(service, batchId, next.item.idx, {
      gallery_attempts: attempts,
      gallery_state: stateAfter,
      gallery_error: msg,
      claimed_at: null,
    });
    await patchBatch(service, batchId, { last_error: msg });
    return { kind: "worked", moreWork: true };
  }
}
