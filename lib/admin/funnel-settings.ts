import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns the timestamp from which the funnel "Live" view counts,
 * or `null` when there has never been a funnel reset.
 */
export async function getFunnelSince(
  service: SupabaseClient,
): Promise<string | null> {
  try {
    const { data, error } = await service
      .from("admin_metrics_settings")
      .select("funnel_since_v2")
      .eq("id", 1)
      .maybeSingle();
    if (error || !data) return null;
    const value = (data as { funnel_since_v2?: string | null }).funnel_since_v2;
    return value && value.trim() ? value : null;
  } catch {
    return null;
  }
}

export async function setFunnelSince(
  service: SupabaseClient,
  iso?: string,
): Promise<{ ok: true; funnelSince: string } | { ok: false; error: string }> {
  const ts = (iso && iso.trim()) || new Date().toISOString();
  const { error } = await service
    .from("admin_metrics_settings")
    .upsert(
      {
        id: 1,
        funnel_since_v2: ts,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true, funnelSince: ts };
}
