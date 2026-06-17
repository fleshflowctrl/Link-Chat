/** ~50% of profiles get a guest photo lock (stable per profile id). */
export function isGuestLockedProfilePhoto(profileId: string): boolean {
  let h = 2166136261;
  for (let i = 0; i < profileId.length; i++) {
    h ^= profileId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 2 === 0;
}

export type GuestPhotoLockCopy = {
  title: string;
  subtitle: string;
};

export function getGuestPhotoLockMessage(
  profileName: string,
): GuestPhotoLockCopy {
  const name = profileName.trim();
  if (!name) {
    return {
      title: "Privémodus staat aan voor de foto's van dit profiel",
      subtitle: "Log in om ze te bekijken",
    };
  }
  return {
    title: `Privémodus staat aan voor ${name}'s foto's`,
    subtitle: "Log in om ze te bekijken",
  };
}
