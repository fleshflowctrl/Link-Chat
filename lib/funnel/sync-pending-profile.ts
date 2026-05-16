"use client";

import {
  clearFunnelPendingProfile,
  readFunnelPendingProfile,
} from "@/lib/funnel/pending-profile";

/** After email confirm / login, apply funnel data that was stashed without a session. */
export async function syncPendingFunnelProfileIfNeeded(): Promise<void> {
  const pending = readFunnelPendingProfile();
  if (!pending) return;

  try {
    const res = await fetch("/api/me/funnel-sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(pending),
    });
    if (res.ok) clearFunnelPendingProfile();
  } catch {
    /* retry on next session refresh */
  }
}
