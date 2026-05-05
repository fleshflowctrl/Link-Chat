import type { Profile } from "@/data/profiles";
import { profiles } from "@/data/profiles";

function overlapCount(profile: Profile, userVibes: string[]): number {
  const set = new Set(profile.vibe ?? []);
  return userVibes.filter((v) => set.has(v)).length;
}

export type FunnelMatchPick = Profile & { matchPercent: number };

const DISPLAY_BADGES = [92, 87, 81] as const;

/**
 * Top 3 catalog profiles for onboarding Step 6 — age filter + vibe overlap,
 * fake match % (60 + shared * 8, capped), ordered for believable badges.
 */
export function pickFunnelMatchProfiles(
  userVibes: string[],
  ageMin: number,
  ageMax: number,
): FunnelMatchPick[] {
  const inRange = profiles.filter(
    (p) => p.age >= ageMin && p.age <= ageMax && p.gallery?.length,
  );
  const pool = inRange.length ? inRange : profiles;

  const scored = pool.map((p) => ({
    p,
    shared: overlapCount(p, userVibes),
  }));

  scored.sort((a, b) => {
    if (b.shared !== a.shared) return b.shared - a.shared;
    return a.p.name.localeCompare(b.p.name);
  });

  const top = scored.slice(0, 3).map((s, i) => ({
    ...s.p,
    matchPercent: DISPLAY_BADGES[i] ?? Math.min(95, 60 + s.shared * 8),
  }));

  if (top.length >= 3) return top;

  const seen = new Set(top.map((t) => t.id));
  for (const p of profiles) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    top.push({
      ...p,
      matchPercent: DISPLAY_BADGES[top.length] ?? 78,
    });
    if (top.length >= 3) break;
  }

  return top.slice(0, 3);
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
  };
  return meta.map((id) => emojis[id] ?? "✨").filter(Boolean);
}
