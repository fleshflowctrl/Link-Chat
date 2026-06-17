"use client";

import { buildAffiliateConversionUrl } from "@/lib/affiliate/conversion-url";

const CLICK_ID_STORAGE = "whisper:aff_click_id";
const CONVERSION_FIRED_STORAGE = "whisper:aff_cv_fired";

/** Read affiliate click id from landing URL (?click_id=…). First touch wins. */
export function captureAffiliateClickFromUrl(): void {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(CLICK_ID_STORAGE)?.trim()) return;

    const params = new URLSearchParams(window.location.search);
    const raw =
      params.get("click_id") ??
      params.get("clickid") ??
      params.get("cid") ??
      params.get("subid");
    const clickId = raw?.trim();
    if (clickId) localStorage.setItem(CLICK_ID_STORAGE, clickId);
  } catch {
    // Best-effort.
  }
}

export function getStoredAffiliateClickId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const id = localStorage.getItem(CLICK_ID_STORAGE)?.trim();
    return id || null;
  } catch {
    return null;
  }
}

/**
 * Client-side postback backup (Image pixel + fetch). Fires at most once per
 * browser (per stored click_id). Server also fires when clickId is sent on signup.
 */
export function fireAffiliateSignupConversion(options?: {
  txid?: string | null;
  payout?: string | null;
}): void {
  if (typeof window === "undefined") return;

  const clickId = getStoredAffiliateClickId();
  if (!clickId) return;

  try {
    if (localStorage.getItem(CONVERSION_FIRED_STORAGE) === "1") return;
  } catch {
    return;
  }

  const txid =
    options?.txid?.trim() ||
    (typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `signup-${Date.now()}`);

  const target = buildAffiliateConversionUrl({
    clickId,
    txid,
    payout: options?.payout ?? undefined,
  });

  try {
    localStorage.setItem(CONVERSION_FIRED_STORAGE, "1");
  } catch {
    // Still attempt the pixel if we can't persist the fired flag.
  }

  const img = new Image();
  img.src = target;

  void fetch(target, { method: "GET", mode: "no-cors", keepalive: true }).catch(
    () => undefined,
  );
}
