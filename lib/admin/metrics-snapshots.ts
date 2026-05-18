import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppVariant } from "@/lib/app-variant";
import { loadAdminMetrics, type AdminMetrics } from "@/lib/admin/metrics";
import {
  getMetricsSince,
  setMetricsSince,
} from "@/lib/admin/metrics-settings";

export type AdminMetricsSnapshot = {
  id: string;
  takenAt: string;
  periodStart: string | null;
  periodEnd: string;
  label: string | null;
  metrics: AdminMetrics;
};

type SnapshotRow = {
  id: string;
  taken_at: string;
  period_start: string | null;
  period_end: string;
  label: string | null;
  metrics: AdminMetrics;
};

function mapRow(row: SnapshotRow): AdminMetricsSnapshot {
  return {
    id: row.id,
    takenAt: row.taken_at,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    label: row.label,
    metrics: row.metrics,
  };
}

/** Captures the current live view as a snapshot and starts a new period. */
export async function captureAndResetMetrics(
  service: SupabaseClient,
  label?: string,
  variant: AppVariant = "v1",
): Promise<
  | { ok: true; snapshot: AdminMetricsSnapshot; metricsSince: string }
  | { ok: false; error: string }
> {
  const previousSince = await getMetricsSince(service, variant);
  let liveMetrics: AdminMetrics;
  try {
    liveMetrics = await loadAdminMetrics(service, {
      since: previousSince,
      variant,
    });
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Snapshot maken mislukt",
    };
  }

  const now = new Date().toISOString();
  const cleanLabel = (label ?? "").trim().slice(0, 120) || null;

  const { data: inserted, error: insertErr } = await service
    .from("admin_metrics_snapshots")
    .insert({
      taken_at: now,
      period_start: previousSince,
      period_end: now,
      label: cleanLabel,
      metrics: liveMetrics,
    })
    .select()
    .single();

  if (insertErr || !inserted) {
    return {
      ok: false,
      error: insertErr?.message ?? "Snapshot opslaan mislukt",
    };
  }

  const update = await setMetricsSince(service, now, variant);
  if (!update.ok) {
    return { ok: false, error: update.error };
  }

  return {
    ok: true,
    snapshot: mapRow(inserted as SnapshotRow),
    metricsSince: update.metricsSince,
  };
}

/** Newest-first list of all stored snapshots. */
export async function listMetricsSnapshots(
  service: SupabaseClient,
): Promise<AdminMetricsSnapshot[]> {
  const { data, error } = await service
    .from("admin_metrics_snapshots")
    .select(
      "id, taken_at, period_start, period_end, label, metrics",
    )
    .order("taken_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as SnapshotRow[]).map(mapRow);
}

export async function getMetricsSnapshot(
  service: SupabaseClient,
  id: string,
): Promise<AdminMetricsSnapshot | null> {
  const { data, error } = await service
    .from("admin_metrics_snapshots")
    .select(
      "id, taken_at, period_start, period_end, label, metrics",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapRow(data as SnapshotRow);
}

export async function getMetricsSnapshotsByIds(
  service: SupabaseClient,
  ids: string[],
): Promise<AdminMetricsSnapshot[]> {
  if (ids.length === 0) return [];
  const { data, error } = await service
    .from("admin_metrics_snapshots")
    .select(
      "id, taken_at, period_start, period_end, label, metrics",
    )
    .in("id", ids);
  if (error) throw new Error(error.message);
  return ((data ?? []) as SnapshotRow[]).map(mapRow);
}
