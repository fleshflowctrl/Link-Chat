/** Load exclusive-content set IDs unlocked for the signed-in user (Supabase). */
export async function fetchUnlockSetIds(): Promise<string[]> {
  try {
    const res = await fetch("/api/me/unlocks", { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as { ok?: boolean; setIds?: string[] };
    if (!data?.ok || !Array.isArray(data.setIds)) return [];
    return data.setIds;
  } catch {
    return [];
  }
}
