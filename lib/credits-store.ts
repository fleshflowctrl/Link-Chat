"use client";

import { meProfile } from "@/data/me";

type Snapshot = {
  version: number;
  balance: number;
  userKey: string;
  /** How many credit packs the user has bought — drives the tiered discount. */
  purchaseCount: number;
};

/** In-memory only — source of truth is Supabase (`user_profiles.credits`). */
let snapshot: Snapshot = {
  version: 0,
  balance: 0,
  userKey: "guest",
  purchaseCount: 0,
};
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function setSnapshot(
  balance: number,
  userKey: string,
  purchaseCount: number = snapshot.purchaseCount,
) {
  snapshot = {
    version: snapshot.version + 1,
    balance,
    userKey,
    purchaseCount,
  };
  emit();
}

async function fetchServerCredits(): Promise<{
  balance: number | null;
  userKey: string;
  purchaseCount: number;
} | null> {
  try {
    const res = await fetch("/api/me/credits", { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      ok?: boolean;
      balance?: number | null;
      userId?: string;
      anonymous?: boolean;
      purchaseCount?: number;
    };
    if (!json.ok) return null;
    if (json.anonymous || !json.userId) {
      return { balance: null, userKey: "guest", purchaseCount: 0 };
    }
    return {
      balance: typeof json.balance === "number" ? json.balance : null,
      userKey: json.userId,
      purchaseCount:
        typeof json.purchaseCount === "number" && json.purchaseCount >= 0
          ? json.purchaseCount
          : 0,
    };
  } catch {
    return null;
  }
}

/** Pull balance from Supabase via /api/me/credits. */
export async function refreshCreditsFromServer(): Promise<void> {
  const server = await fetchServerCredits();
  if (!server) return;

  if (server.userKey === "guest" || server.balance === null) {
    setSnapshot(meProfile.stats.credits.value, "guest", 0);
    return;
  }

  setSnapshot(server.balance, server.userKey, server.purchaseCount);
}

export function initCreditsStore() {
  if (typeof window === "undefined") return;
  void refreshCreditsFromServer();
}

export function resetCreditsToGuest() {
  setSnapshot(meProfile.stats.credits.value, "guest", 0);
}

export function getCreditsSnapshot(): Snapshot {
  return snapshot;
}

export function subscribeCredits(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * Server APIs (gifts, unlocks, purchases) are authoritative — call
 * `applyServerCreditsUpdate` with the balance they return.
 */
export function applyServerCreditsUpdate(balance: number) {
  if (!Number.isFinite(balance) || balance < 0) return;
  setSnapshot(balance, snapshot.userKey);
}

export function applyServerPurchaseUpdate(
  balance: number,
  purchaseCount: number,
) {
  if (!Number.isFinite(balance) || balance < 0) return;
  if (!Number.isFinite(purchaseCount) || purchaseCount < 0) return;
  setSnapshot(balance, snapshot.userKey, Math.floor(purchaseCount));
}

/** After signup the DB row is seeded by saveFunnelAccount — just refetch. */
export function resetCreditsForNewUser(_userKey: string | null) {
  void refreshCreditsFromServer();
}
