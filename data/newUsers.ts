/**
 * “New on whisper” rail — mock join times are offsets from `Date.now()` whenever
 * `getNewWhisperUsers()` runs so copy stays fresh; `joinedAt` is ISO for helpers.
 */
export type NewWhisperUserSeed = {
  id: string;
  name: string;
  avatar: string;
  /** Minutes since this user “joined” (relative to each `getNewWhisperUsers()` call). */
  joinedMinutesAgo: number;
};

export type NewWhisperUser = NewWhisperUserSeed & {
  joinedAt: string;
};

const SEED: NewWhisperUserSeed[] = [
  {
    id: "sophie",
    name: "Sophie",
    avatar:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&q=80&auto=format&fit=crop",
    joinedMinutesAgo: 2,
  },
  {
    id: "clara",
    name: "Clara",
    avatar:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&q=80&auto=format&fit=crop",
    joinedMinutesAgo: 8,
  },
  {
    id: "lena",
    name: "Lena",
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80&auto=format&fit=crop",
    joinedMinutesAgo: 15,
  },
  {
    id: "mia",
    name: "Mia",
    avatar:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&q=80&auto=format&fit=crop",
    joinedMinutesAgo: 32,
  },
  {
    id: "ava",
    name: "Ava",
    avatar:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80&auto=format&fit=crop",
    joinedMinutesAgo: 60,
  },
  {
    id: "zoe",
    name: "Zoe",
    avatar:
      "https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=200&q=80&auto=format&fit=crop",
    joinedMinutesAgo: 120,
  },
  {
    id: "iris",
    name: "Iris",
    avatar:
      "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&q=80&auto=format&fit=crop",
    joinedMinutesAgo: 180,
  },
  {
    id: "nora",
    name: "Nora",
    avatar:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&q=80&auto=format&fit=crop",
    joinedMinutesAgo: 300,
  },
];

export function getNewWhisperUsers(): NewWhisperUser[] {
  const now = Date.now();
  return SEED.map((s) => ({
    ...s,
    joinedAt: new Date(now - s.joinedMinutesAgo * 60_000).toISOString(),
  }));
}

const NEW_BADGE_MAX_MS = 30 * 60 * 1000;

export function showNewJoinBadge(joinedAt: string, now = Date.now()): boolean {
  return now - new Date(joinedAt).getTime() <= NEW_BADGE_MAX_MS;
}

/** e.g. 2m ago, 1h ago — recalculates from ISO on each call. */
export function formatJoinedAgo(joinedAt: string, now = Date.now()): string {
  const diffMs = Math.max(0, now - new Date(joinedAt).getTime());
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}
