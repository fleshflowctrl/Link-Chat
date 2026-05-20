import type { AppVariant } from "@/lib/app-variant";

/** v2 reply timing (operational — separate from the chat rulebook). */
export const V2_MAX_REPLY_DELAY_MS = 60_000;

export const V2_MIN_REPLY_DELAY_MS = 8_000;

/** Hold HTTP open for v2 sync delivery up to the 1-minute cap. */
export function v2SyncDelayThresholdMs(): number {
  return V2_MAX_REPLY_DELAY_MS;
}

export function isV2ChatProfile(
  profile: { app_variant?: string | null } | null | undefined,
): boolean {
  return profile?.app_variant === "v2";
}

/**
 * v2 chat rulebook — Grok system-prompt blocks. Intentionally empty until a new
 * rulebook is written. When ready, add sections here and wire them in
 * `build-grok-system-prompt.ts` (search for V2_CHAT_*).
 */
export const V2_CHAT_SYSTEM_APPEND = "";

export const V2_FLIRT_BLOCK = "";

export const V2_SEXUAL_MOMENT_RULE = "";
