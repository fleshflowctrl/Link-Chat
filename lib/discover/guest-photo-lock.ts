/** ~50% of profiles get a guest photo lock (stable per profile id). */
export function isGuestLockedProfilePhoto(profileId: string): boolean {
  let h = 2166136261;
  for (let i = 0; i < profileId.length; i++) {
    h ^= profileId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 2 === 0;
}

export function getGuestPhotoLockMessage(profileName: string): string {
  const name = profileName.trim() || "dit profiel";
  return `Meld je aan om de foto's van ${name} te zien`;
}
