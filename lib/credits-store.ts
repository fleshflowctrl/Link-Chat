"use client";

import { WHISPER_USER_KEY } from "@/data/funnel";
import { meProfile } from "@/data/me";

const CREDITS_KEY_PREFIX = "whisper_credits";
const ACTIVE_USER_KEY = "whisper_credits_active_user";

type Snapshot = { version: number; balance: number; userKey: string };

let snapshot: Snapshot = {
  version: 0,
  balance: meProfile.stats.credits.value,
  userKey: "guest",
};
const listeners = new Set<() => void>();
let initialized = false;
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
} | null> {
  try {
    const res = await fetch("/api/me/credits", { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      ok?: boolean;
      balance?: number | null;
      userId?: string;
      anonymous?: boolean;
    };
    if (!json.ok) return null;
    if (json.anonymous || !json.userId) {
      return { balance: null, userKey: "guest" };
    }
    return {
      balance: typeof json.balance === "number" ? json.balance : null,
      userKey: json.userId,
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

function setSnapshot(balance: number, userKey: string) {
  snapshot = { version: snapshot.version + 1, balance, userKey };
  emit();
}

export function initCreditsStore() {
  if (typeof window === "undefined") return;
  if (initialized) return;
  initialized = true;

  // 1. Render fast with whatever local data we already have.
  let activeUser: string;
  try {
    activeUser = localStorage.getItem(ACTIVE_USER_KEY) || "guest";
  } catch {
    activeUser = "guest";
  }

  const localBalance = readLocalBalance(activeUser);
  if (localBalance !== null) {
    setSnapshot(localBalance, activeUser);
  } else {
    const fallback =
      readSignupCreditsFallback() ?? meProfile.stats.credits.value;
    setSnapshot(fallback, activeUser);
  }

  // 2. Sync from server in the background. This is the source of truth for
  // logged-in users — the per-user balance lives in user_profiles.credits.
  void fetchServerCredits().then((server) => {
    if (!server) return;

    if (server.userKey !== snapshot.userKey) {
      // Logged in as a different user (or just logged in). Switch contexts:
      // load the fresh user's balance and don't carry over previous state.
      const fresh = server.balance ?? readLocalBalance(server.userKey) ?? 0;
      writeLocalBalance(server.userKey, fresh);
      setSnapshot(fresh, server.userKey);
      return;
    }

    if (server.balance !== null && server.balance !== snapshot.balance) {
      writeLocalBalance(server.userKey, server.balance);
      setSnapshot(server.balance, server.userKey);
    }
  });
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
  setSnapshot(startingBalance, key);
  scheduleServerSync(startingBalance, key);
}
