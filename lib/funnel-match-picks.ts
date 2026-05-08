import type { FunnelLookingFor } from "@/data/funnel";
import type { Profile } from "@/data/profiles";
import { profiles as staticCatalogProfiles } from "@/data/profiles";

function overlapCount(profile: Profile, userVibes: string[]): number {
  const set = new Set(profile.vibe ?? []);
  return userVibes.filter((v) => set.has(v)).length;
}

export type FunnelMatchPick = Profile & { matchPercent: number };

const FUNNEL_MATCH_COUNT = 10;

/** Deterministic 0..~5 “random” so match % is stable per profile + vibe set. */
function matchJitter(profileId: string, userVibesKey: string): number {
  let h = 0;
  const s = `${profileId}:${userVibesKey}`;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return ((h >>> 0) % 1000) / 1000;
}

function intentBonus(
  p: Profile,
  userLookingFor: FunnelLookingFor | null,
): number {
  if (!userLookingFor || userLookingFor === "notsure") return 0;
  const ids = p.funnelIntentIds;
  if (!ids?.length) return 0;
  return ids.includes(userLookingFor) ? 5 : 0;
}

function scoreProfile(
  p: Profile,
  userVibes: string[],
  userVibesKey: string,
  userLookingFor: FunnelLookingFor | null,
): { shared: number; matchPercent: number } {
  const shared = overlapCount(p, userVibes);
  const jitter = matchJitter(p.id, userVibesKey) * 5;
  let matchPercent = Math.min(98, Math.round(60 + shared * 8 + jitter));
  matchPercent = Math.min(98, matchPercent + intentBonus(p, userLookingFor));
  return { shared, matchPercent };
}

/**
 * Up to 10 catalog profiles for onboarding Step 6 — age filter + vibe overlap +
 * small boost when the user’s “looking for” overlaps `funnelIntentIds` on the row.
 *
 * @param catalog — Prefer `chat_profiles` via `fetchFunnelCatalogProfilesServer()`; falls back to bundled static list when empty.
 */
export function pickFunnelMatchProfiles(
  catalog: Profile[],
  userVibes: string[],
  userLookingFor: FunnelLookingFor | null,
  ageMin: number,
  ageMax: number,
): FunnelMatchPick[] {
  const base = catalog.length > 0 ? catalog : staticCatalogProfiles;
  const userVibesKey = [...userVibes].sort().join(",");

  const inRange = base.filter(
    (p) => p.age >= ageMin && p.age <= ageMax && p.gallery?.length,
  );
  const pool = inRange.length ? inRange : base.filter((p) => p.gallery?.length);

  const scored = pool.map((p) => {
    const { shared, matchPercent } = scoreProfile(
      p,
      userVibes,
      userVibesKey,
      userLookingFor,
    );
    return { p, shared, matchPercent };
  });

  scored.sort((a, b) => {
    if (b.matchPercent !== a.matchPercent) return b.matchPercent - a.matchPercent;
    if (b.shared !== a.shared) return b.shared - a.shared;
    return a.p.name.localeCompare(b.p.name);
  });

  const top = scored.slice(0, FUNNEL_MATCH_COUNT).map((s) => ({
    ...s.p,
    matchPercent: s.matchPercent,
  }));

  if (top.length >= FUNNEL_MATCH_COUNT) return top;

  const seen = new Set(top.map((t) => t.id));
  const rest = base.filter((p) => !seen.has(p.id) && p.gallery?.length);
  for (const p of rest) {
    if (top.length >= FUNNEL_MATCH_COUNT) break;
    const { matchPercent } = scoreProfile(
      p,
      userVibes,
      userVibesKey,
      userLookingFor,
    );
    top.push({ ...p, matchPercent });
    seen.add(p.id);
  }

  return top.slice(0, FUNNEL_MATCH_COUNT);
}

export function sharedVibeEmojis(
  profile: Profile,
  userVibes: string[],
  max = 2,
): string[] {
  const meta = userVibes
    .filter((v) => (profile.vibe ?? []).includes(v))
    .slice(0, max);
  const emojis: Record<string, string> = {
    caring: "💗",
    romantic: "💜",
    playful: "🙂",
    warm: "👥",
    listener: "🎧",
    coffee: "☕",
    travel: "✈️",
    movies: "🎬",
    gym: "💪",
    reading: "📚",
    gaming: "🎮",
    art: "🎨",
    witty: "🌶️",
    chill: "🌿",
    cooking: "🍳",
  };
  return meta.map((id) => emojis[id] ?? "✨").filter(Boolean);
}
