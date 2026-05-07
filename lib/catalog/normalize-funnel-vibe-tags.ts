import { FUNNEL_VIBE_ID_SET } from "@/data/funnel";

const FALLBACK: string[] = ["chill", "playful"];

/**
 * Filters to canonical funnel vibe ids (deduped, order preserved).
 * Use for `chat_profiles.vibe_tags` and `Profile.vibe` from DB.
 */
export function normalizeFunnelVibeTags(candidates: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of candidates) {
    const id = String(raw).trim().toLowerCase();
    if (!id || !FUNNEL_VIBE_ID_SET.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out.length > 0 ? out : [...FALLBACK];
}
