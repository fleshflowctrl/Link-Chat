import { buildAffiliateConversionUrl } from "@/lib/affiliate/conversion-url";

/**
 * Server-side 911-for-me conversion postback (signup / CV).
 * Fire-and-forget — does not block the signup response.
 */
export function fireAffiliateSignupConversionServer(input: {
  clickId: string;
  txid: string;
  payout?: string | null;
}): void {
  const clickId = input.clickId.trim();
  const txid = input.txid.trim();
  if (!clickId || !txid) return;

  const target = buildAffiliateConversionUrl({
    clickId,
    txid,
    payout: input.payout,
  });

  void fetch(target, {
    method: "GET",
    signal: AbortSignal.timeout(15_000),
  }).catch((e) => {
    console.warn("[affiliate-cv]", e instanceof Error ? e.message : e);
  });
}
