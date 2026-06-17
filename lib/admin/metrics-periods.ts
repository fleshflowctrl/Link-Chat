import type { AppVariant } from "@/lib/app-variant";

export type MetricsPeriodLevel = "month" | "week" | "day";

export type MetricsPeriodInput = {
  since: string | null;
  variant: AppVariant;
  users: Array<{ id: string; createdAt: string | null }>;
  purchases: Array<{
    userId: string;
    amountCents: number;
    purchaseCountBefore: number;
    createdAt: string;
  }>;
  chatterIds: Set<string>;
  aiFunnelIds: Set<string>;
  payingUserIds: Set<string>;
  repeatPurchaseCount: number;
};

export type MetricsPeriodRow = {
  key: string;
  label: string;
  level: MetricsPeriodLevel;
  users: number;
  purchases: number;
  revenueCents: number;
  payingUsers: number;
  /** Next drilldown level when rows are expandable. */
  childLevel: MetricsPeriodLevel | null;
};

type Bucket = {
  users: number;
  purchases: number;
  revenueCents: number;
  payingUsers: Set<string>;
};

function emptyBucket(): Bucket {
  return { users: 0, purchases: 0, revenueCents: 0, payingUsers: new Set() };
}

function monthKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function dayKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** ISO week key, e.g. `2026-W24`. */
function weekKey(d: Date): string {
  const tmp = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((tmp.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${tmp.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function bucketKeyForLevel(d: Date, level: MetricsPeriodLevel): string {
  if (level === "month") return monthKey(d);
  if (level === "week") return weekKey(d);
  return dayKey(d);
}

function inParentScope(
  d: Date,
  level: MetricsPeriodLevel,
  parentKey: string | undefined,
): boolean {
  if (!parentKey) return true;
  if (level === "week") return monthKey(d) === parentKey;
  if (level === "day") return weekKey(d) === parentKey;
  return true;
}

function formatPeriodLabel(key: string, level: MetricsPeriodLevel): string {
  if (level === "month") {
    const [y, m] = key.split("-");
    const d = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
    return d.toLocaleDateString("nl-NL", { month: "short", year: "numeric" });
  }
  if (level === "week") {
    const match = /^(\d{4})-W(\d{2})$/.exec(key);
    if (!match) return key;
    return `Week ${Number(match[2])}, ${match[1]}`;
  }
  const d = new Date(`${key}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return key;
  return d.toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function childLevelFor(level: MetricsPeriodLevel): MetricsPeriodLevel | null {
  if (level === "month") return "week";
  if (level === "week") return "day";
  return null;
}

export function buildMetricsPeriodRows(
  input: MetricsPeriodInput,
  level: MetricsPeriodLevel,
  parentKey?: string,
): MetricsPeriodRow[] {
  const buckets = new Map<string, Bucket>();

  function touch(key: string): Bucket {
    let b = buckets.get(key);
    if (!b) {
      b = emptyBucket();
      buckets.set(key, b);
    }
    return b;
  }

  for (const u of input.users) {
    if (!u.createdAt) continue;
    const d = new Date(u.createdAt);
    if (Number.isNaN(d.getTime()) || !inParentScope(d, level, parentKey)) continue;
    touch(bucketKeyForLevel(d, level)).users += 1;
  }

  for (const p of input.purchases) {
    const d = new Date(p.createdAt);
    if (Number.isNaN(d.getTime()) || !inParentScope(d, level, parentKey)) continue;
    const b = touch(bucketKeyForLevel(d, level));
    b.purchases += 1;
    b.revenueCents += p.amountCents;
    b.payingUsers.add(p.userId);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, b]) => ({
      key,
      label: formatPeriodLabel(key, level),
      level,
      users: b.users,
      purchases: b.purchases,
      revenueCents: b.revenueCents,
      payingUsers: b.payingUsers.size,
      childLevel: childLevelFor(level),
    }));
}
