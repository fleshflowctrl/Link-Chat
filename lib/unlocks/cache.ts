/** @deprecated Unlock ids are stored in Supabase — fetch /api/me/unlocks only.
 *  These helpers are no-ops kept so call sites don't need a large refactor. */

export function readCachedUnlocks(_userKey: string): string[] {
  return [];
}

export function writeCachedUnlocks(_userKey: string, _ids: string[]): void {
  /* no-op — server is source of truth */
}
