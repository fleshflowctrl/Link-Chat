/** Per-user localStorage cache for exclusive-content unlocks.
 *
 *  Used by:
 *  - components/links/exclusive-content-store.tsx (the /links page itself)
 *  - components/me/my-exclusive-content.tsx (the "Mijn collectie" box on /me)
 *
 *  Keyed by `userKey` (Supabase user id from credits-store, or "guest" when
 *  not signed in) so that two accounts in the same browser don't see each
 *  other's purchases.
 */

const UNLOCKS_KEY_PREFIX = "whisper_unlocked_content";

function unlocksKey(userKey: string): string {
  return `${UNLOCKS_KEY_PREFIX}:${userKey}`;
}

export function readCachedUnlocks(userKey: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(unlocksKey(userKey));
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

export function writeCachedUnlocks(userKey: string, ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(unlocksKey(userKey), JSON.stringify(ids));
  } catch {
    /* quota / privacy mode — survive gracefully */
  }
}
