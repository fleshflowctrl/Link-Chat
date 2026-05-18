"use client";

const CLICK_ID_STORAGE = "whisper:aff_click_id";
const CONVERSION_FIRED_STORAGE = "whisper:aff_cv_fired";

const CV_ENDPOINT = "https://911-for-me.com/cf/cv";

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

function buildConversionUrl(clickId: string, txid: string, payout?: string): string {
  const url = new URL(CV_ENDPOINT);
  url.searchParams.set("click_id", clickId);
  url.searchParams.set("txid", txid);
  const payoutVal =
    payout?.trim() ||
    (typeof process.env.NEXT_PUBLIC_AFFILIATE_CV_PAYOUT === "string"
      ? process.env.NEXT_PUBLIC_AFFILIATE_CV_PAYOUT.trim()
      : "");
  if (payoutVal) url.searchParams.set("payout", payoutVal);
  return url.toString();
}

/**
 * Postback for a successful funnel signup (step 7). Fires at most once per
 * browser session storage (per stored click_id).
 */
export function fireAffiliateSignupConversion(options?: {
  /** Unique conversion id — defaults to user id or a random uuid. */
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

  const target = buildConversionUrl(clickId, txid, options?.payout ?? undefined);

  try {
    localStorage.setItem(CONVERSION_FIRED_STORAGE, "1");
  } catch {
    // Still attempt the pixel if we can't persist the fired flag.
  }

  // Tracking pixel — reliable for third-party postbacks (adblockers may still block).
  const img = new Image();
  img.src = target;

  void fetch(target, { method: "GET", mode: "no-cors", keepalive: true }).catch(
    () => undefined,
  );
}
