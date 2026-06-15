/** ~50% of profiles get a guest photo lock (stable per profile id). */
export function isGuestLockedProfilePhoto(profileId: string): boolean {
  let h = 2166136261;
  for (let i = 0; i < profileId.length; i++) {
    h ^= profileId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 2 === 0;
}

export const GUEST_PHOTO_LOCK_MESSAGE =
  "Log in om profielfoto's te zien";
