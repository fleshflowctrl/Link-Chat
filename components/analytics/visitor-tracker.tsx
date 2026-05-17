"use client";

import { useEffect } from "react";
import { trackVisit } from "@/lib/analytics/visitor-id";

/**
 * Pings `/api/track/visit` once per mount with a localStorage-stored UUID.
 * Mount this on landing pages where you want to count unique visitors
 * (e.g. the public funnel entry).
 */
export function VisitorTracker() {
  useEffect(() => {
    void trackVisit();
  }, []);
  return null;
}
