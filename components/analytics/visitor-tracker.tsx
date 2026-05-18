"use client";

import { useEffect } from "react";
import type { AppVariant } from "@/lib/app-variant";
import { trackVisit } from "@/lib/analytics/visitor-id";

/**
 * Pings `/api/track/visit` once per mount with a localStorage-stored UUID.
 * Mount this on landing pages where you want to count unique visitors
 * (e.g. the public funnel entry).
 */
export function VisitorTracker({ variant }: { variant?: AppVariant } = {}) {
  useEffect(() => {
    void trackVisit(variant);
  }, [variant]);
  return null;
}
