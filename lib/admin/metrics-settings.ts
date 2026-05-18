import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns the timestamp from which the live /admin/metrics view should
 * count, or `null` when there has never been a reset (= count everything).
 * Failures fall back to `null` so the dashboard always renders.
 */
export async function getMetricsSince(
  service: SupabaseClient,
): Promise<string | null> {
  try {
    const { data, error } = await service
      .from("admin_metrics_settings")
      .select("metrics_since")
      .eq("id", 1)
      .maybeSingle();
    if (error || !data) return null;
    const value = (data as { metrics_since: string | null }).metrics_since;
    return value && value.trim() ? value : null;
  } catch {
    return null;
  }
}

/** Update the cutoff to `iso` (or now() when omitted). */
export async function setMetricsSince(
  service: SupabaseClient,
  iso?: string,
): Promise<{ ok: true; metricsSince: string } | { ok: false; error: string }> {
  const ts = (iso && iso.trim()) || new Date().toISOString();
  const { error } = await service
    .from("admin_metrics_settings")
    .upsert(
      {
        id: 1,
        metrics_since: ts,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true, metricsSince: ts };
}
