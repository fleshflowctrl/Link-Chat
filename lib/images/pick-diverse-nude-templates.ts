/**
 * Pick nude scene templates with maximum camera-family diversity so a
 * batch of 3 exclusive photos does not collapse into three mirror selfies.
 */

export type NudeTemplatePickInput = {
  id: string;
  scene: string;
  camera: string;
  pose: string;
};

export type NudeTemplateBucket =
  | "close-up"
  | "low-angle"
  | "high-angle"
  | "from-behind"
  | "mirror"
  | "side"
  | "other";

/** Group a template into a camera-family bucket (shared by admin UI + backend). */
export function bucketNudeTemplate(t: Pick<NudeTemplatePickInput, "scene" | "camera" | "pose">): NudeTemplateBucket {
  const txt = `${t.camera} ${t.pose} ${t.scene}`.toLowerCase();
  if (/extreme close|tight crop|almost touching|close-up of (breast|nipple|pussy|ass|tit|labia|vagina|feet)/.test(txt)) {
    return "close-up";
  }
  if (/between (her |the )?legs|between thighs|low angle|from below|phone held low|ground|tussen.*benen/.test(txt)) {
    return "low-angle";
  }
  if (/high angle|above|overhead|looking down|phone above|from above|bird/.test(txt)) {
    return "high-angle";
  }
  if (/over.*shoulder|from behind|kont naar camera|ass to camera|back to camera/.test(txt)) {
    return "from-behind";
  }
  if (/mirror|reflection|spiegel/.test(txt)) {
    return "mirror";
  }
  if (/3\/4|sideways|side angle|profile/.test(txt)) {
    return "side";
  }
  return "other";
}

/**
 * Pick up to `n` templates with different camera families. At most one
 * mirror-selfie per batch so three standing bathroom mirrors cannot win.
 */
export function pickDiverseNudeTemplates<T extends NudeTemplatePickInput>(
  pool: T[],
  n: number,
  opts?: { excludeIds?: string[] },
): T[] {
  const exclude = new Set(opts?.excludeIds ?? []);
  const available = pool.filter((t) => t.id && !exclude.has(t.id));
  if (available.length === 0) return [];

  const buckets = new Map<NudeTemplateBucket, T[]>();
  for (const t of available) {
    const b = bucketNudeTemplate(t);
    const arr = buckets.get(b) ?? [];
    arr.push(t);
    buckets.set(b, arr);
  }

  // Prefer non-mirror families first so mirror does not eat all three slots.
  const bucketKeys = Array.from(buckets.keys()).sort((a, b) => {
    const rank = (k: NudeTemplateBucket) =>
      k === "mirror" ? 2 : k === "other" ? 1 : 0;
    return rank(a) - rank(b);
  });
  for (let i = bucketKeys.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bucketKeys[i], bucketKeys[j]] = [bucketKeys[j]!, bucketKeys[i]!];
  }

  const picked: T[] = [];
  const usedIds = new Set<string>();
  let mirrorUsed = false;

  const takeFromBucket = (key: NudeTemplateBucket): boolean => {
    if (key === "mirror" && mirrorUsed) return false;
    const candidates = (buckets.get(key) ?? []).filter((t) => !usedIds.has(t.id));
    if (candidates.length === 0) return false;
    const choice = candidates[Math.floor(Math.random() * candidates.length)]!;
    picked.push(choice);
    usedIds.add(choice.id);
    if (key === "mirror") mirrorUsed = true;
    return true;
  };

  let round = 0;
  while (picked.length < n && round < 12) {
    let progressed = false;
    for (const key of bucketKeys) {
      if (picked.length >= n) break;
      if (takeFromBucket(key)) progressed = true;
    }
    if (!progressed) break;
    round++;
  }

  // Still short — fill with any unused template (never duplicate ids).
  if (picked.length < n) {
    const rest = available.filter((t) => !usedIds.has(t.id));
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j]!, rest[i]!];
    }
    for (const t of rest) {
      if (picked.length >= n) break;
      if (usedIds.has(t.id)) continue;
      const b = bucketNudeTemplate(t);
      if (b === "mirror" && mirrorUsed) continue;
      picked.push(t);
      usedIds.add(t.id);
      if (b === "mirror") mirrorUsed = true;
    }
  }

  return picked;
}
