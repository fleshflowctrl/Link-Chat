import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppVariant } from "@/lib/app-variant";

/**
 * Returns the timestamp from which the live metrics view should
 * count, or `null` when there has never been a reset (= count everything).
 * Failures fall back to `null` so the dashboard always renders.
 */
export async function getMetricsSince(
  service: SupabaseClient,
  variant: AppVariant = "v1",
): Promise<string | null> {
  const column = variant === "v2" ? "metrics_since_v2" : "metrics_since";
  try {
    const { data, error } = await service
      .from("admin_metrics_settings")
      .select(column)
      .eq("id", 1)
      .maybeSingle();
    if (error || !data) return null;
    const value = (data as Record<string, string | null>)[column];
    return value && value.trim() ? value : null;
  } catch {
    return null;
  }
}

/** Update the cutoff to `iso` (or now() when omitted). */
export async function setMetricsSince(
  service: SupabaseClient,
  iso?: string,
  variant: AppVariant = "v1",
): Promise<{ ok: true; metricsSince: string } | { ok: false; error: string }> {
  const column = variant === "v2" ? "metrics_since_v2" : "metrics_since";
  const ts = (iso && iso.trim()) || new Date().toISOString();
  const { error } = await service
    .from("admin_metrics_settings")
    .upsert(
      {
        id: 1,
        [column]: ts,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true, metricsSince: ts };
}
