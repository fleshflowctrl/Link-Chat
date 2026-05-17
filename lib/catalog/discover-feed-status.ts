import type { Profile } from "@/data/profiles";

/** Share the hourly-feed hash so status badges are stable per slot + user. */
function fnv1aHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function statusRoll(profileId: string, userKey: string, feedSlot: number): number {
  return fnv1aHash(`${userKey}::${feedSlot}::badge::${profileId}`) % 100;
}

/**
 * Discover (page 1) status chips — only ~10% "live", ~10% "Nieuw", rest none.
 * Deterministic per profile + hourly slot so the feed feels stable, not random
 * on every re-render.
 */
export function applyDiscoverFeedStatus(
  profile: Profile,
  userKey: string,
  feedSlot: number,
): Profile {
  const roll = statusRoll(profile.id, userKey, feedSlot);

  if (roll < 10) {
    const liveVariant =
      fnv1aHash(`${profile.id}::live-kind`) % 2 === 0 ? "online" : "active";
    return {
      ...profile,
      status: {
        variant: liveVariant,
        label: liveVariant === "online" ? "Nu online" : "Actief nu",
      },
    };
  }

  if (roll < 20) {
    return {
      ...profile,
      status: { variant: "new", label: "Nieuw" },
    };
  }

  return {
    ...profile,
    status: { variant: "quiet", label: "" },
  };
}

export function applyDiscoverFeedStatusToProfiles(
  profiles: Profile[],
  userKey: string,
  feedSlot: number,
): Profile[] {
  return profiles.map((p) => applyDiscoverFeedStatus(p, userKey, feedSlot));
}
