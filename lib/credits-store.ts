"use client";

import { WHISPER_USER_KEY } from "@/data/funnel";
import { meProfile } from "@/data/me";

const CREDITS_KEY_PREFIX = "whisper_credits";
const ACTIVE_USER_KEY = "whisper_credits_active_user";

type Snapshot = {
  version: number;
  balance: number;
  userKey: string;
  /** How many credit packs the user has bought — drives the tiered discount. */
  purchaseCount: number;
};

let snapshot: Snapshot = {
  version: 0,
  balance: meProfile.stats.credits.value,
  userKey: "guest",
  purchaseCount: 0,
};
const listeners = new Set<() => void>();
let serverSyncTimer: ReturnType<typeof setTimeout> | null = null;

function emit() {
  listeners.forEach((l) => l());
}

function storageKey(userKey: string): string {
  return `${CREDITS_KEY_PREFIX}:${userKey}`;
}

function readLocalBalance(userKey: string): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(userKey));
    if (raw === null) return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

function writeLocalBalance(userKey: string, balance: number) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(userKey), String(balance));
    localStorage.setItem(ACTIVE_USER_KEY, userKey);
  } catch {
    /* ignore */
  }
}

function readSignupCreditsFallback(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(WHISPER_USER_KEY);
    if (!raw) return null;
    const u = JSON.parse(raw) as { credits?: unknown };
    if (typeof u.credits === "number" && u.credits >= 0) return u.credits;
  } catch {
    /* ignore */
  }
  return null;
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

function scheduleServerSync(balance: number, userKey: string) {
  if (typeof window === "undefined") return;
  if (userKey === "guest") return;
  if (serverSyncTimer) clearTimeout(serverSyncTimer);
  serverSyncTimer = setTimeout(() => {
    serverSyncTimer = null;
    void fetch("/api/me/credits", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ balance }),
    }).catch(() => {
      /* ignore — best effort */
    });
  }, 250);
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

/** Pull balance from /api/me/credits — never trust ACTIVE_USER_KEY alone
 * because it can still point at the previous account until this runs. */
async function refreshCreditsFromServer(): Promise<void> {
  const server = await fetchServerCredits();
  if (!server) return;

  if (server.userKey === "guest" || server.balance === null) {
    const fallback =
      readSignupCreditsFallback() ?? meProfile.stats.credits.value;
    setSnapshot(fallback, "guest", 0);
    return;
  }

  const local = readLocalBalance(server.userKey);
  const balance = server.balance ?? local ?? 0;
  writeLocalBalance(server.userKey, balance);
  setSnapshot(balance, server.userKey, server.purchaseCount);
}

export function initCreditsStore() {
  if (typeof window === "undefined") return;
  void refreshCreditsFromServer();
}

/** After sign-out — don't show the previous user's balance. */
export function resetCreditsToGuest() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(ACTIVE_USER_KEY);
  } catch {
    /* ignore */
  }
  setSnapshot(meProfile.stats.credits.value, "guest", 0);
}

export function getCreditsSnapshot(): Snapshot {
  return snapshot;
}

export function subscribeCredits(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function spendCredits(amount: number): boolean {
  if (snapshot.balance < amount) return false;
  const next = snapshot.balance - amount;
  writeLocalBalance(snapshot.userKey, next);
  setSnapshot(next, snapshot.userKey);
  scheduleServerSync(next, snapshot.userKey);
  return true;
}

export function addCredits(amount: number) {
  const next = snapshot.balance + amount;
  writeLocalBalance(snapshot.userKey, next);
  setSnapshot(next, snapshot.userKey);
  scheduleServerSync(next, snapshot.userKey);
}

/**
 * Sync the local snapshot to a balance the server just confirmed (e.g. after a
 * gift). Skips the debounced PUT-back since the value is already authoritative.
 */
export function applyServerCreditsUpdate(balance: number) {
  if (!Number.isFinite(balance) || balance < 0) return;
  writeLocalBalance(snapshot.userKey, balance);
  setSnapshot(balance, snapshot.userKey);
}

/**
 * Like {@link applyServerCreditsUpdate} but also bumps the purchase counter
 * (used after a successful credit-pack purchase so the next price tier kicks
 * in immediately without a re-fetch round trip).
 */
export function applyServerPurchaseUpdate(
  balance: number,
  purchaseCount: number,
) {
  if (!Number.isFinite(balance) || balance < 0) return;
  if (!Number.isFinite(purchaseCount) || purchaseCount < 0) return;
  writeLocalBalance(snapshot.userKey, balance);
  setSnapshot(balance, snapshot.userKey, Math.floor(purchaseCount));
}

/**
 * Called by the funnel right after a successful signup so the new account
 * starts with a clean per-user balance, even if the previous test session
 * had purchases or other state in localStorage.
 */
export function resetCreditsForNewUser(
  userKey: string | null,
  startingBalance: number,
) {
  if (typeof window === "undefined") return;
  const key = userKey && userKey.length > 0 ? userKey : "guest";
  writeLocalBalance(key, startingBalance);
  setSnapshot(startingBalance, key, 0);
  scheduleServerSync(startingBalance, key);
}
