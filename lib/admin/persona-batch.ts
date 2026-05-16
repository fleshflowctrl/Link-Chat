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

/** Items stuck in `*_state='running'` longer than this are assumed to
 * have been orphaned by a crashed tick and get reset to 'pending' on
 * the next tick. 5 minutes covers Vercel's max function lifetime plus
 * cold-start padding. */
const STUCK_THRESHOLD_MS = 5 * 60 * 1000;

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

/** Kick off the next worker tick. Returns once the request is either
 * delivered or a short grace window has elapsed — we don't want the
 * current function to outlive the trigger but we also need the new
 * tick's HTTP request to make it onto the wire before we return. */
export async function triggerNextTick(
  baseUrl: string,
  batchId: string,
): Promise<void> {
  const url = `${baseUrl}/api/admin/personas/batch/tick`;
  const token = workerToken(batchId);
  const body = JSON.stringify({ batchId, token });

  const fetchPromise = fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    // Don't cache or follow auth cookies; this is server-to-server.
    cache: "no-store",
  })
    .then(() => null)
    .catch(() => null);

  // Race a short delay so we don't block on the new tick's actual work
  // (it would do its own self-trigger before responding anyway), but we
  // wait long enough that the TCP/HTTP request has been sent.
  await Promise.race([
    fetchPromise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
  ]);
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
  await service
    .from("chat_persona_batch_items")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("batch_id", batchId)
    .eq("idx", idx);
}

async function patchBatch(
  service: SupabaseClient,
  batchId: string,
  patch: Partial<BatchRow>,
): Promise<void> {
  await service
    .from("chat_persona_batches")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", batchId);
}

/** Reset any items whose claimed_at is older than STUCK_THRESHOLD_MS.
 * The worker is single-stream per batch but a crashed/timed-out tick
 * can leave an item half-running; recovering it lets the next tick
 * make progress instead of getting stuck on the row forever. */
async function recoverStuckItems(
  service: SupabaseClient,
  batchId: string,
  now: number,
): Promise<void> {
  const cutoff = new Date(now - STUCK_THRESHOLD_MS).toISOString();
  // Reset each running phase independently — they share `claimed_at`.
  const { data: stuck } = await service
    .from("chat_persona_batch_items")
    .select("idx, profile_state, photo_state, gallery_state")
    .eq("batch_id", batchId)
    .lt("claimed_at", cutoff)
    .or(
      "profile_state.eq.running,photo_state.eq.running,gallery_state.eq.running",
    );
  for (const row of (stuck ?? []) as Array<
    Pick<BatchItemRow, "idx" | "profile_state" | "photo_state" | "gallery_state">
  >) {
    const patch: Partial<BatchItemRow> = { claimed_at: null };
    if (row.profile_state === "running") patch.profile_state = "pending";
    if (row.photo_state === "running") patch.photo_state = "pending";
    if (row.gallery_state === "running") patch.gallery_state = "pending";
    await patchItem(service, batchId, row.idx, patch);
  }
}

type NextUnit =
  | { kind: "profile"; item: BatchItemRow }
  | { kind: "avatar"; item: BatchItemRow }
  | { kind: "gallery"; item: BatchItemRow; variant: number }
  | { kind: "none" };

/** Find the lowest-index item that still has work to do. We always
 * fully complete one persona before moving on:
 *   1. profile pending → profile
 *   2. profile done + (with_photos && photo pending) → avatar
 *   3. profile done + photo finalised + gallery_done < target → gallery
 * Items that have hit a hard error in profile/avatar are skipped at
 * each subsequent phase, so a profile failure never stalls the batch.
 */
function pickNextUnit(batch: BatchRow, items: BatchItemRow[]): NextUnit {
  for (const item of items) {
    if (item.profile_state === "pending") {
      return { kind: "profile", item };
    }
    if (item.profile_state === "running") {
      // Some other tick is on it (or it just got stuck and will be
      // recovered next pass). Skip for now to avoid double-work.
      continue;
    }
    if (item.profile_state !== "done") {
      // Errored or skipped at phase 1 — nothing else to do for this row.
      continue;
    }
    if (!batch.with_photos) continue;

    if (item.photo_state === "pending") {
      return { kind: "avatar", item };
    }
    if (item.photo_state === "running") continue;
    // Photo can be 'done', 'error', or 'skipped' here — gallery proceeds
    // either way (worst case the gallery uses the placeholder's photo_style).

    if (
      item.gallery_state !== "done" &&
      item.gallery_state !== "error" &&
      item.gallery_state !== "skipped" &&
      item.gallery_state !== "running" &&
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
  }
  return { kind: "none" };
}

export type RunOneStepResult =
  | { kind: "worked"; moreWork: boolean }
  | { kind: "missing-batch" }
  | { kind: "stopped"; reason: "cancelled" | "done" | "failed" };

/** Process exactly one unit of work for a batch. Caller is responsible
 * for triggering the next tick when `moreWork === true`. */
export async function runOneStep(
  service: SupabaseClient,
  batchId: string,
): Promise<RunOneStepResult> {
  const batch = await loadBatch(service, batchId);
  if (!batch) return { kind: "missing-batch" };
  if (batch.status === "cancelled") return { kind: "stopped", reason: "cancelled" };
  if (batch.status === "done") return { kind: "stopped", reason: "done" };
  if (batch.status === "failed") return { kind: "stopped", reason: "failed" };

  const now = Date.now();
  await recoverStuckItems(service, batchId, now);

  if (batch.status === "pending") {
    await patchBatch(service, batchId, { status: "running" });
  }

  const items = await loadItems(service, batchId);
  const next = pickNextUnit(batch, items);

  if (next.kind === "none") {
    await patchBatch(service, batchId, {
      status: "done",
      finished_at: new Date().toISOString(),
    });
    return { kind: "stopped", reason: "done" };
  }

  const nowIso = new Date().toISOString();

  if (next.kind === "profile") {
    await patchItem(service, batchId, next.item.idx, {
      profile_state: "running",
      claimed_at: nowIso,
      profile_error: null,
    });
    try {
      const result = await createPersonaFromBrief(service, {
        brief: batch.brief,
        index: next.item.idx,
        total: batch.total,
        exclude: [...batch.exclude_ids, ...batch.exclude_names].slice(0, 24),
        attractiveness: batch.attractiveness,
        body_type: batch.body_type,
        age_min: batch.age_min,
        age_max: batch.age_max,
      });
      if (!result.ok) {
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
    await patchItem(service, batchId, next.item.idx, {
      photo_state: "running",
      claimed_at: nowIso,
      photo_error: null,
    });
    try {
      const result = await regeneratePersonaAvatar(service, {
        personaId: next.item.persona_id,
        variant: batch.scene_offset + next.item.idx,
      });
      if (!result.ok) {
        await patchItem(service, batchId, next.item.idx, {
          photo_state: "error",
          photo_error: result.error,
          claimed_at: null,
        });
        await patchBatch(service, batchId, { last_error: result.error });
        return { kind: "worked", moreWork: true };
      }
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
  await patchItem(service, batchId, next.item.idx, {
    gallery_state: "running",
    claimed_at: nowIso,
    gallery_error: null,
  });
  try {
    const result = await appendPersonaGalleryPhoto(service, {
      personaId: next.item.persona_id,
      variant: next.variant,
    });
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
