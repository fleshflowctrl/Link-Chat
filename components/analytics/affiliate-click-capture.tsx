"use client";

import { useEffect } from "react";
import { captureAffiliateClickFromUrl } from "@/lib/affiliate/911-for-me";

/** Stores ?click_id= from the landing URL for the 911-for-me conversion postback. */
export function AffiliateClickCapture() {
  useEffect(() => {
    captureAffiliateClickFromUrl();
  }, []);
  return null;
}
