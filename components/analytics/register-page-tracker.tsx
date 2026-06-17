"use client";

import { useEffect } from "react";
import { FUNNEL_STEP_REGISTER_PAGE } from "@/lib/analytics/funnel-steps";
import { trackFunnelStep } from "@/lib/analytics/visitor-id";

/** Records a unique visit to the signup/register page per browser. */
export function RegisterPageTracker() {
  useEffect(() => {
    void trackFunnelStep(FUNNEL_STEP_REGISTER_PAGE, "v2");
  }, []);
  return null;
}
