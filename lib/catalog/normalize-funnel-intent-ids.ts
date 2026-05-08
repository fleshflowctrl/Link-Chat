import { FUNNEL_LOOKING_ID_SET } from "@/data/funnel";

/** Deduped funnel "looking for" ids from DB (subset of FUNNEL_LOOKING_FOR ids). */
export function normalizeFunnelIntentIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of raw) {
    const id = typeof x === "string" ? x.trim() : "";
    if (!id || !FUNNEL_LOOKING_ID_SET.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
