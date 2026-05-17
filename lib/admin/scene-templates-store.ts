/**
 * Server-side DAL for the `scene_templates` table.
 *
 * The picker (`pickFreshSceneTemplate` in lib/images/scene-templates.ts)
 * uses this module to load its candidate pool from the DB. The admin
 * UI uses it to list, generate, reject and restore templates.
 *
 * Fallback strategy:
 *   - If the DB tabel exists but is empty, the operator hasn't seeded
 *     yet. `loadActiveTemplatesForSlot` returns null in that case and
 *     the picker falls back to the in-code SCENE_TEMPLATES constant.
 *     This keeps photo generation working out-of-the-box on a fresh
 *     environment.
 *   - If the DB query fails outright (table missing, permission denied,
 *     network) we also return null so the picker can use the in-code
 *     fallback. Errors are logged but never surfaced to the caller.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  SCENE_TEMPLATES,
  templateId,
  type SceneTemplate,
} from "@/lib/images/scene-templates";

export const SCENE_TEMPLATES_TABLE = "scene_templates";

/** Allowed values for the operator-supplied rejection tags. The picker
 * doesn't care about these — they exist so the Grok generator can be
 * told "the operator keeps rejecting templates with X issue" without
 * having to parse free-text. */
export const REJECTION_TAGS = [
  "te-generiek",
  "outfit-mismatch",
  "leeftijd-issue",
  "ongeloofwaardig",
  "doublure",
  "anders",
] as const;
export type RejectionTag = (typeof REJECTION_TAGS)[number];

export type SceneTemplateRow = SceneTemplate & {
  id: string;
  template_id: string;
  category: string | null;
  age_tier_hint: "young" | "mid" | "old" | "any" | null;
  source: string;
  is_active: boolean;
  rejected_at: string | null;
  rejection_reason: string | null;
  rejection_tags: string[] | null;
  created_at: string;
  updated_at: string;
};

type Row = Record<string, unknown>;

function rowToTemplateRow(r: Row): SceneTemplateRow {
  const tags = Array.isArray(r.rejection_tags)
    ? (r.rejection_tags as unknown[]).filter(
        (t): t is string => typeof t === "string",
      )
    : null;
  return {
    id: String(r.id ?? ""),
    template_id: String(r.template_id ?? ""),
    scene: String(r.scene ?? ""),
    camera: String(r.camera ?? ""),
    backdrop: String(r.backdrop ?? ""),
    lighting: String(r.lighting ?? ""),
    capture: String(r.capture ?? ""),
    outfit: String(r.outfit ?? ""),
    pose: String(r.pose ?? ""),
    kind: (r.kind === "avatar" || r.kind === "gallery" || r.kind === "mixed"
      ? (r.kind as SceneTemplate["kind"])
      : "gallery"),
    category: typeof r.category === "string" ? r.category : null,
    age_tier_hint:
      r.age_tier_hint === "young" ||
      r.age_tier_hint === "mid" ||
      r.age_tier_hint === "old" ||
      r.age_tier_hint === "any"
        ? r.age_tier_hint
        : null,
    source: String(r.source ?? "seed"),
    is_active: r.is_active !== false,
    rejected_at: typeof r.rejected_at === "string" ? r.rejected_at : null,
    rejection_reason:
      typeof r.rejection_reason === "string" ? r.rejection_reason : null,
    rejection_tags: tags,
    created_at: String(r.created_at ?? new Date().toISOString()),
    updated_at: String(r.updated_at ?? new Date().toISOString()),
  };
}

/** Loads active templates for one slot. Returns null when the DB
 * lookup fails or the table is empty, signalling the caller to fall
 * back to the in-code constant. */
export async function loadActiveTemplatesForSlot(
  service: SupabaseClient,
  slot: "avatar" | "gallery",
): Promise<SceneTemplate[] | null> {
  try {
    // Avatar slot: prefer 'avatar' + 'mixed'. Gallery slot: any non-nude kind.
    // Nude templates have category="nude" and live in their own pool.
    const kinds = slot === "avatar" ? ["avatar", "mixed"] : ["avatar", "gallery", "mixed"];
    const { data, error } = await service
      .from(SCENE_TEMPLATES_TABLE)
      .select(
        "scene, camera, backdrop, lighting, capture, outfit, pose, kind, template_id, category",
      )
      .eq("is_active", true)
      .in("kind", kinds)
      .or("category.is.null,category.neq.nude");
    if (error) throw error;
    if (!data || data.length === 0) return null;
    return (data as Row[]).map((r) => ({
      scene: String(r.scene ?? ""),
      camera: String(r.camera ?? ""),
      backdrop: String(r.backdrop ?? ""),
      lighting: String(r.lighting ?? ""),
      capture: String(r.capture ?? ""),
      outfit: String(r.outfit ?? ""),
      pose: String(r.pose ?? ""),
      kind:
        r.kind === "avatar" || r.kind === "gallery" || r.kind === "mixed"
          ? (r.kind as SceneTemplate["kind"])
          : "gallery",
    }));
  } catch (err) {
    console.warn("[scene-templates-store] loadActiveTemplatesForSlot failed", {
      slot,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export type ListOpts = {
  /** Page number, 1-based. */
  page?: number;
  pageSize?: number;
  /** Filter by kind. */
  kind?: SceneTemplate["kind"] | "any";
  /** Filter by category (exact match). */
  category?: string;
  /** Filter active / rejected / all. */
  state?: "active" | "rejected" | "any";
  /** Sort. Default: newest first. */
  sort?: "newest" | "oldest";
};

export type ListResult = {
  rows: SceneTemplateRow[];
  total: number;
  page: number;
  pageSize: number;
};

export async function listTemplates(
  service: SupabaseClient,
  opts: ListOpts = {},
): Promise<ListResult> {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const pageSize = Math.min(200, Math.max(1, Math.floor(opts.pageSize ?? 50)));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = service
    .from(SCENE_TEMPLATES_TABLE)
    .select("*", { count: "exact" })
    .or("category.is.null,category.neq.nude") // hide nude templates from the normal admin list
    .range(from, to);

  q = opts.sort === "oldest"
    ? q.order("created_at", { ascending: true })
    : q.order("created_at", { ascending: false });

  if (opts.kind && opts.kind !== "any") q = q.eq("kind", opts.kind);
  if (opts.category) q = q.eq("category", opts.category);
  if (opts.state === "active") q = q.eq("is_active", true);
  if (opts.state === "rejected") q = q.eq("is_active", false);
  // 'any' = no filter.

  const { data, error, count } = await q;
  if (error) throw error;

  return {
    rows: ((data ?? []) as Row[]).map(rowToTemplateRow),
    total: count ?? 0,
    page,
    pageSize,
  };
}

export type StatsResult = {
  total: number;
  active: number;
  rejected: number;
  byKind: { avatar: number; gallery: number; mixed: number };
  byCategory: Array<{ category: string; count: number }>;
  recentRejections: SceneTemplateRow[];
};

export async function getStats(
  service: SupabaseClient,
): Promise<StatsResult> {
  const { data, error } = await service
    .from(SCENE_TEMPLATES_TABLE)
    .select("kind, category, is_active")
    .or("category.is.null,category.neq.nude"); // nudes managed separately on /admin/nudes
  if (error) throw error;
  const rows = (data ?? []) as Row[];
  let active = 0;
  let rejected = 0;
  const byKind = { avatar: 0, gallery: 0, mixed: 0 };
  const cats = new Map<string, number>();
  for (const r of rows) {
    if (r.is_active === false) rejected++;
    else active++;
    const k = String(r.kind ?? "");
    if (k === "avatar" || k === "gallery" || k === "mixed") byKind[k]++;
    const c = typeof r.category === "string" && r.category ? r.category : null;
    if (c) cats.set(c, (cats.get(c) ?? 0) + 1);
  }
  const byCategory = Array.from(cats.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  // Last 10 rejections — used by the admin UI as a "recent issues"
  // sidebar and also fed back to Grok in the generator. Exclude nude
  // rejections, those have their own admin panel.
  const { data: rj, error: rjErr } = await service
    .from(SCENE_TEMPLATES_TABLE)
    .select("*")
    .eq("is_active", false)
    .or("category.is.null,category.neq.nude")
    .order("rejected_at", { ascending: false })
    .limit(10);
  if (rjErr) throw rjErr;

  return {
    total: rows.length,
    active,
    rejected,
    byKind,
    byCategory,
    recentRejections: ((rj ?? []) as Row[]).map(rowToTemplateRow),
  };
}

export async function rejectTemplate(
  service: SupabaseClient,
  id: string,
  opts: { reason: string; tags?: RejectionTag[] },
): Promise<SceneTemplateRow> {
  const reason = opts.reason.trim().slice(0, 600);
  if (!reason) throw new Error("rejection_reason mag niet leeg zijn");
  const tags = (opts.tags ?? []).filter((t): t is RejectionTag =>
    (REJECTION_TAGS as readonly string[]).includes(t),
  );
  const { data, error } = await service
    .from(SCENE_TEMPLATES_TABLE)
    .update({
      is_active: false,
      rejected_at: new Date().toISOString(),
      rejection_reason: reason,
      rejection_tags: tags.length > 0 ? tags : null,
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Template niet gevonden");
  return rowToTemplateRow(data as Row);
}

/** After a successful persona photo render: log usage and remove the
 * template from `scene_templates` so it can never be picked again.
 * Single-use pool — operator generates more via Grok when running low.
 *
 * Test renders (`/api/admin/scene-templates/[id]/test-render`) do NOT
 * call this — only production avatar/gallery generation in persona-ops.
 *
 * Best-effort: failures are logged and swallowed so a tracking/delete
 * glitch never fails the whole photo upload. */
export async function recordAndConsumeSceneTemplateUse(opts: {
  service: SupabaseClient;
  personaId: string;
  slot: "avatar" | "gallery";
  template: SceneTemplate;
}): Promise<void> {
  const tid = templateId(opts.template);

  try {
    const { error } = await opts.service
      .from("chat_persona_photo_templates")
      .insert({
        persona_id: opts.personaId,
        slot: opts.slot,
        template_id: tid,
        template_scene: opts.template.scene,
      });
    if (error) throw error;
  } catch (err) {
    console.warn("[scene-templates] recordSceneTemplateUse failed", {
      personaId: opts.personaId,
      slot: opts.slot,
      templateId: tid,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    const { error } = await opts.service
      .from(SCENE_TEMPLATES_TABLE)
      .delete()
      .eq("template_id", tid);
    if (error) throw error;
    invalidateDbStateCache();
  } catch (err) {
    console.warn("[scene-templates] consumeSceneTemplateFromPool failed", {
      personaId: opts.personaId,
      slot: opts.slot,
      templateId: tid,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Hard delete one or more templates. Used by the bulk-delete UI when
 * the operator wants to remove obviously-bad templates without writing
 * a per-template rejection reason. Returns the number of rows actually
 * removed (best-effort — Supabase doesn't always populate `count` on
 * delete responses so we count the returned ids).
 *
 * Note: rows in `chat_persona_photo_templates` that reference the
 * deleted template_id are *not* cleaned up (no FK constraint). Those
 * orphan rows are harmless — the picker only uses them to avoid
 * reusing a template inside one persona, so orphans just mean those
 * personas continue to skip a template_id that no longer exists. */
export async function deleteTemplates(
  service: SupabaseClient,
  ids: string[],
): Promise<{ deleted: number }> {
  if (!Array.isArray(ids) || ids.length === 0) return { deleted: 0 };
  // Cap at a sane batch size so a hostile payload can't OOM the DB.
  const safeIds = ids.slice(0, 5000);
  const { data, error } = await service
    .from(SCENE_TEMPLATES_TABLE)
    .delete()
    .in("id", safeIds)
    .select("id");
  if (error) throw error;
  return { deleted: Array.isArray(data) ? data.length : 0 };
}

/** Variant of listTemplates that returns only ids, without pagination.
 * Used by the admin UI's "select all matching filter" button so the
 * operator can bulk-act on every row in a filtered view (e.g. delete
 * all rejected templates) without paging through them.
 *
 * Capped at 10k ids to protect the JSON payload size.
 */
export async function listTemplateIds(
  service: SupabaseClient,
  opts: Omit<ListOpts, "page" | "pageSize"> = {},
): Promise<string[]> {
  let q = service
    .from(SCENE_TEMPLATES_TABLE)
    .select("id")
    .or("category.is.null,category.neq.nude")
    .order("created_at", { ascending: false })
    .limit(10_000);
  if (opts.kind && opts.kind !== "any") q = q.eq("kind", opts.kind);
  if (opts.category) q = q.eq("category", opts.category);
  if (opts.state === "active") q = q.eq("is_active", true);
  if (opts.state === "rejected") q = q.eq("is_active", false);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
}

export async function restoreTemplate(
  service: SupabaseClient,
  id: string,
): Promise<SceneTemplateRow> {
  const { data, error } = await service
    .from(SCENE_TEMPLATES_TABLE)
    .update({
      is_active: true,
      rejected_at: null,
      rejection_reason: null,
      rejection_tags: null,
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Template niet gevonden");
  return rowToTemplateRow(data as Row);
}

/** Bulk insert. Dedupes on `template_id` by attempting an upsert with
 * ignoreDuplicates so a Grok batch that happens to re-emit an existing
 * template (rare but possible) doesn't blow up the whole call. Returns
 * the rows that were actually inserted. */
export async function insertTemplates(
  service: SupabaseClient,
  templates: SceneTemplate[],
  meta: {
    source: string;
    category?: string | null;
    age_tier_hint?: "young" | "mid" | "old" | "any" | null;
  },
): Promise<{ inserted: number; skipped: number; rows: SceneTemplateRow[] }> {
  if (templates.length === 0) {
    return { inserted: 0, skipped: 0, rows: [] };
  }
  // Compute template_id for each row so the unique constraint can do
  // the dedup work for us. Skip locally-duplicate rows inside the same
  // batch (Grok occasionally emits two clones in one response).
  const seen = new Set<string>();
  const payload: Array<{
    scene: string;
    camera: string;
    backdrop: string;
    lighting: string;
    capture: string;
    outfit: string;
    pose: string;
    kind: SceneTemplate["kind"];
    template_id: string;
    category: string | null;
    age_tier_hint: string | null;
    source: string;
    is_active: boolean;
  }> = [];
  for (const t of templates) {
    const tid = templateId(t);
    if (seen.has(tid)) continue;
    seen.add(tid);
    payload.push({
      scene: t.scene,
      camera: t.camera,
      backdrop: t.backdrop,
      lighting: t.lighting,
      capture: t.capture,
      outfit: t.outfit,
      pose: t.pose,
      kind: t.kind,
      template_id: tid,
      category: meta.category ?? null,
      age_tier_hint: meta.age_tier_hint ?? null,
      source: meta.source,
      is_active: true,
    });
  }
  if (payload.length === 0) {
    return { inserted: 0, skipped: templates.length, rows: [] };
  }
  // Use upsert with ignoreDuplicates so existing template_ids are
  // skipped rather than causing the entire insert to fail. Supabase-js
  // sets the `Prefer: resolution=ignore-duplicates` header.
  const { data, error } = await service
    .from(SCENE_TEMPLATES_TABLE)
    .upsert(payload, { onConflict: "template_id", ignoreDuplicates: true })
    .select("*");
  if (error) throw error;
  const insertedRows = ((data ?? []) as Row[]).map(rowToTemplateRow);
  return {
    inserted: insertedRows.length,
    skipped: templates.length - insertedRows.length,
    rows: insertedRows,
  };
}

/** One-shot helper for the admin "seed from code" button. Inserts the
 * in-code SCENE_TEMPLATES into the DB, marked with source="seed". Safe
 * to call multiple times — the unique template_id index makes it
 * idempotent. */
export async function seedFromCode(
  service: SupabaseClient,
): Promise<{ inserted: number; skipped: number }> {
  const result = await insertTemplates(service, [...SCENE_TEMPLATES], {
    source: "seed",
  });
  return { inserted: result.inserted, skipped: result.skipped };
}

/** Returns true when the DB has at least one row in scene_templates.
 * Used by the picker to decide whether to consult the DB or fall back
 * to in-code. We cache the result for 60s to avoid hammering the DB on
 * every photo generation. */
let dbStateCache: { ts: number; nonEmpty: boolean } | null = null;
const DB_STATE_TTL_MS = 60_000;
export async function hasAnyDbTemplates(
  service: SupabaseClient,
): Promise<boolean> {
  const now = Date.now();
  if (dbStateCache && now - dbStateCache.ts < DB_STATE_TTL_MS) {
    return dbStateCache.nonEmpty;
  }
  try {
    const { count, error } = await service
      .from(SCENE_TEMPLATES_TABLE)
      .select("id", { count: "exact", head: true })
      .limit(1);
    if (error) throw error;
    const nonEmpty = (count ?? 0) > 0;
    dbStateCache = { ts: now, nonEmpty };
    return nonEmpty;
  } catch (err) {
    console.warn("[scene-templates-store] hasAnyDbTemplates failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/** Bust the cache when we know the DB just changed (after an insert
 * or seed). Otherwise the cache may make freshly-inserted templates
 * invisible to the picker for up to 60s. */
export function invalidateDbStateCache(): void {
  dbStateCache = null;
}

/** Loads the most recent rejection reasons + tags. Fed back into the
 * Grok generator's system prompt so the model stops reproducing the
 * same mistakes. Hard-cap at 30 — beyond that the prompt gets too
 * heavy and Grok starts losing the schema. */
export async function loadRecentRejections(
  service: SupabaseClient,
  limit = 20,
): Promise<
  Array<{
    scene: string;
    outfit: string;
    pose: string;
    rejection_reason: string;
    rejection_tags: string[];
  }>
> {
  const capped = Math.min(30, Math.max(1, limit));
  try {
    const { data, error } = await service
      .from(SCENE_TEMPLATES_TABLE)
      .select("scene, outfit, pose, rejection_reason, rejection_tags, category")
      .eq("is_active", false)
      .or("category.is.null,category.neq.nude")
      .not("rejection_reason", "is", null)
      .order("rejected_at", { ascending: false })
      .limit(capped);
    if (error) throw error;
    return ((data ?? []) as Row[]).map((r) => ({
      scene: String(r.scene ?? ""),
      outfit: String(r.outfit ?? ""),
      pose: String(r.pose ?? ""),
      rejection_reason: String(r.rejection_reason ?? ""),
      rejection_tags: Array.isArray(r.rejection_tags)
        ? (r.rejection_tags as unknown[]).filter(
            (t): t is string => typeof t === "string",
          )
        : [],
    }));
  } catch (err) {
    console.warn("[scene-templates-store] loadRecentRejections failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

// ============================================================================
// NUDE TEMPLATES — same store, category = "nude" rows only (kind stays
// "gallery" so we don't need a CHECK-constraint migration; every nude
// query filters by category = "nude" and every non-nude query excludes
// it via .neq("category", "nude")).
// ============================================================================

const NUDE_CATEGORY = "nude";

/** Loads active NUDE templates from the DB. Returns null when the lookup
 * fails or no nude rows exist (caller falls back to in-code NUDE_TEMPLATES). */
export async function loadActiveNudeTemplates(
  service: SupabaseClient,
): Promise<SceneTemplate[] | null> {
  try {
    const { data, error } = await service
      .from(SCENE_TEMPLATES_TABLE)
      .select(
        "scene, camera, backdrop, lighting, capture, outfit, pose, kind, template_id",
      )
      .eq("is_active", true)
      .eq("category", NUDE_CATEGORY);
    if (error) throw error;
    if (!data || data.length === 0) return null;
    return (data as Row[]).map((r) => ({
      scene: String(r.scene ?? ""),
      camera: String(r.camera ?? ""),
      backdrop: String(r.backdrop ?? ""),
      lighting: String(r.lighting ?? ""),
      capture: String(r.capture ?? ""),
      outfit: String(r.outfit ?? ""),
      pose: String(r.pose ?? ""),
      kind: "gallery" as SceneTemplate["kind"],
    }));
  } catch (err) {
    console.warn("[scene-templates-store] loadActiveNudeTemplates failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** Sample a few active nude templates as few-shot examples for the Grok generator. */
export async function sampleActiveNudeTemplatesForFewShot(
  service: SupabaseClient,
  count = 6,
): Promise<SceneTemplate[]> {
  try {
    const { data, error } = await service
      .from(SCENE_TEMPLATES_TABLE)
      .select("scene, camera, backdrop, lighting, capture, outfit, pose, kind")
      .eq("is_active", true)
      .eq("category", NUDE_CATEGORY)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    const pool = (data ?? []) as Row[];
    if (pool.length === 0) return [];
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    return shuffled.slice(0, Math.min(count, shuffled.length)).map((r) => ({
      scene: String(r.scene ?? ""),
      camera: String(r.camera ?? ""),
      backdrop: String(r.backdrop ?? ""),
      lighting: String(r.lighting ?? ""),
      capture: String(r.capture ?? ""),
      outfit: String(r.outfit ?? ""),
      pose: String(r.pose ?? ""),
      kind: "gallery" as SceneTemplate["kind"],
    }));
  } catch (err) {
    console.warn(
      "[scene-templates-store] sampleActiveNudeTemplatesForFewShot failed",
      { error: err instanceof Error ? err.message : String(err) },
    );
    return [];
  }
}

/** Load recent rejections for the nude-templates feedback loop. */
export async function loadRecentNudeRejections(
  service: SupabaseClient,
  limit = 15,
): Promise<
  Array<{
    scene: string;
    outfit: string;
    pose: string;
    rejection_reason: string | null;
    rejection_tags: string[];
  }>
> {
  const capped = Math.min(30, Math.max(1, limit));
  try {
    const { data, error } = await service
      .from(SCENE_TEMPLATES_TABLE)
      .select("scene, outfit, pose, rejection_reason, rejection_tags, category")
      .eq("is_active", false)
      .eq("category", NUDE_CATEGORY)
      .not("rejection_reason", "is", null)
      .order("rejected_at", { ascending: false })
      .limit(capped);
    if (error) throw error;
    return ((data ?? []) as Row[]).map((r) => ({
      scene: String(r.scene ?? ""),
      outfit: String(r.outfit ?? ""),
      pose: String(r.pose ?? ""),
      rejection_reason: typeof r.rejection_reason === "string" ? r.rejection_reason : null,
      rejection_tags: Array.isArray(r.rejection_tags)
        ? (r.rejection_tags as unknown[]).filter(
            (t): t is string => typeof t === "string",
          )
        : [],
    }));
  } catch (err) {
    console.warn("[scene-templates-store] loadRecentNudeRejections failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/** List nude templates with pagination — used by the /admin/nudes templates panel. */
export async function listNudeTemplates(
  service: SupabaseClient,
  opts: { page?: number; pageSize?: number; state?: "active" | "rejected" | "any" } = {},
): Promise<ListResult> {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const pageSize = Math.min(200, Math.max(1, Math.floor(opts.pageSize ?? 50)));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = service
    .from(SCENE_TEMPLATES_TABLE)
    .select("*", { count: "exact" })
    .eq("category", NUDE_CATEGORY)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (opts.state === "active") q = q.eq("is_active", true);
  else if (opts.state === "rejected") q = q.eq("is_active", false);

  const { data, error, count } = await q;
  if (error) throw error;

  return {
    rows: ((data ?? []) as Row[]).map(rowToTemplateRow),
    total: count ?? 0,
    page,
    pageSize,
  };
}

/** Sample a handful of high-quality (active) templates as few-shot
 * examples for the Grok generator. We randomise the sample server-side
 * so successive generation batches see different few-shot examples and
 * Grok stays diverse. */
export async function sampleActiveTemplatesForFewShot(
  service: SupabaseClient,
  count = 8,
): Promise<SceneTemplate[]> {
  try {
    // Pull a wider window then randomise client-side; Postgres random()
    // sort is slow at scale, and at 1000+ rows we'd be pulling huge
    // payloads anyway. Limit ~200 then shuffle.
    const { data, error } = await service
      .from(SCENE_TEMPLATES_TABLE)
      .select("scene, camera, backdrop, lighting, capture, outfit, pose, kind, category")
      .eq("is_active", true)
      .or("category.is.null,category.neq.nude")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    const pool = (data ?? []) as Row[];
    if (pool.length === 0) {
      // First-ever generate call before seed — fall back to a handful
      // of in-code examples so Grok still gets shape guidance.
      return SCENE_TEMPLATES.slice(0, Math.min(count, SCENE_TEMPLATES.length)) as SceneTemplate[];
    }
    // Fisher-Yates shuffle, take first `count`.
    const shuffled = [...pool];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    return shuffled.slice(0, Math.min(count, shuffled.length)).map((r) => ({
      scene: String(r.scene ?? ""),
      camera: String(r.camera ?? ""),
      backdrop: String(r.backdrop ?? ""),
      lighting: String(r.lighting ?? ""),
      capture: String(r.capture ?? ""),
      outfit: String(r.outfit ?? ""),
      pose: String(r.pose ?? ""),
      kind:
        r.kind === "avatar" || r.kind === "gallery" || r.kind === "mixed"
          ? (r.kind as SceneTemplate["kind"])
          : "gallery",
    }));
  } catch (err) {
    console.warn(
      "[scene-templates-store] sampleActiveTemplatesForFewShot failed",
      { error: err instanceof Error ? err.message : String(err) },
    );
    return SCENE_TEMPLATES.slice(0, Math.min(count, SCENE_TEMPLATES.length)) as SceneTemplate[];
  }
}
