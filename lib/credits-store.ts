"use client";

import { WHISPER_USER_KEY } from "@/data/funnel";
import { meProfile } from "@/data/me";

const CREDITS_KEY = "whisper_credits";

type Snapshot = { version: number; balance: number };

function readInitialBalance(): number {
  if (typeof window === "undefined") return meProfile.stats.credits.value;
  try {
    const raw = localStorage.getItem(CREDITS_KEY);
    if (raw !== null) return Math.max(0, parseInt(raw, 10) || 0);
    const userRaw = localStorage.getItem(WHISPER_USER_KEY);
    if (userRaw) {
      const u = JSON.parse(userRaw) as { credits?: unknown };
      if (typeof u.credits === "number" && u.credits >= 0) return u.credits;
    }
  } catch { /* ignore */ }
  return meProfile.stats.credits.value;
}

let snapshot: Snapshot = { version: 0, balance: meProfile.stats.credits.value };
const listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }

export function initCreditsStore() {
  if (typeof window === "undefined") return;
  snapshot = { version: snapshot.version + 1, balance: readInitialBalance() };
  emit();
}

export function getCreditsSnapshot(): Snapshot { return snapshot; }

export function subscribeCredits(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * Deduct `amount` credits. Returns `true` on success, `false` when balance too low.
 */
export function spendCredits(amount: number): boolean {
  if (snapshot.balance < amount) return false;
  const next = snapshot.balance - amount;
  snapshot = { version: snapshot.version + 1, balance: next };
  try { localStorage.setItem(CREDITS_KEY, String(next)); } catch { /* ignore */ }
  emit();
  return true;
}

export function addCredits(amount: number) {
  const next = snapshot.balance + amount;
  snapshot = { version: snapshot.version + 1, balance: next };
  try { localStorage.setItem(CREDITS_KEY, String(next)); } catch { /* ignore */ }
  emit();
}
