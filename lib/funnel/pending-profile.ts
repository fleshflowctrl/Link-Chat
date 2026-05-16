"use client";

import type { FunnelAgeRange, FunnelLookingFor } from "@/data/funnel";
import type {
  FunnelGender,
  FunnelSeekingGender,
} from "@/lib/funnel/save-funnel-account";

export const FUNNEL_PENDING_PROFILE_KEY = "whisper_funnel_pending_profile";

export type FunnelPendingProfile = {
  lookingFor: FunnelLookingFor | null;
  gender: FunnelGender | null;
  seekingGender: FunnelSeekingGender | null;
  ageRange: FunnelAgeRange;
  startingCredits: number;
  pickedMatchId?: string | null;
  firstMessage?: string | null;
};

export function stashFunnelPendingProfile(data: FunnelPendingProfile): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(FUNNEL_PENDING_PROFILE_KEY, JSON.stringify(data));
  } catch {
    /* private mode */
  }
}

export function readFunnelPendingProfile(): FunnelPendingProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(FUNNEL_PENDING_PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FunnelPendingProfile;
  } catch {
    return null;
  }
}

export function clearFunnelPendingProfile(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(FUNNEL_PENDING_PROFILE_KEY);
  } catch {
    /* ignore */
  }
}
