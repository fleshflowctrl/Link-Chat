"use client";

import {
  APP_VARIANT_STORAGE,
  parseAppVariant,
  type AppVariant,
} from "@/lib/app-variant";

const STORAGE_KEY = "whisper:vid";

function resolveTrackingVariant(explicit?: AppVariant): AppVariant {
  if (explicit) return explicit;
  if (typeof window === "undefined") return "v1";
  try {
    const stored = window.localStorage.getItem(APP_VARIANT_STORAGE);
    if (stored) return parseAppVariant(stored);
  } catch {
    /* ignore */
  }
  return parseAppVariant(
    document.cookie.match(/(?:^|; )whisper_app_variant=([^;]*)/)?.[1] ??
      null,
  );
}

function generateUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback (very old browsers): RFC4122 v4-ish
  const rnd = (n: number) =>
    Array.from({ length: n }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join("");
  return `${rnd(8)}-${rnd(4)}-4${rnd(3)}-a${rnd(3)}-${rnd(12)}`;
}

/** Returns a stable per-browser UUID, creating one on first call. */
export function getOrCreateVisitorId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY);
    if (existing) return existing;
    const fresh = generateUuid();
    window.localStorage.setItem(STORAGE_KEY, fresh);
    return fresh;
  } catch {
    return null;
  }
}

/** Fire-and-forget visitor ping. Safe to call repeatedly. */
export async function trackVisit(variant?: AppVariant): Promise<void> {
  const visitorId = getOrCreateVisitorId();
  if (!visitorId) return;
  const appVariant = resolveTrackingVariant(variant);
  try {
    await fetch("/api/track/visit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        visitorId,
        appVariant,
        referrer:
          typeof document !== "undefined" ? document.referrer || null : null,
      }),
      keepalive: true,
    });
  } catch {
    // Tracking is best-effort: never break UX.
  }
}

/**
 * Records the first time the visitor reaches an onboarding funnel step.
 * Server-side upsert deduplicates on (visitor, step), so it's safe to
 * fire on every render.
 */
export async function trackFunnelStep(
  step: number,
  variant?: AppVariant,
): Promise<void> {
  const visitorId = getOrCreateVisitorId();
  if (!visitorId) return;
  if (!Number.isFinite(step) || step < 1) return;
  const appVariant = resolveTrackingVariant(variant);
  try {
    await fetch("/api/track/funnel-step", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ visitorId, step, appVariant }),
      keepalive: true,
    });
  } catch {
    // Best-effort.
  }
}

/** Links the current visitor to a newly signed-up user. */
export async function trackSignupLink(
  userId: string | null,
  variant?: AppVariant,
): Promise<void> {
  const visitorId = getOrCreateVisitorId();
  if (!visitorId) return;
  const appVariant = resolveTrackingVariant(variant);
  try {
    await fetch("/api/track/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        visitorId,
        userId: userId ?? undefined,
        appVariant,
      }),
      keepalive: true,
    });
  } catch {
    // Best-effort.
  }
}
