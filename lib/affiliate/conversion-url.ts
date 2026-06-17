export const AFFILIATE_CV_ENDPOINT = "https://911-for-me.com/cf/cv";

export function parseAffiliateClickId(raw: unknown): string | null {
  const id = typeof raw === "string" ? raw.trim() : "";
  if (!id || id.length > 256) return null;
  return id;
}

export function buildAffiliateConversionUrl(input: {
  clickId: string;
  txid: string;
  payout?: string | null;
}): string {
  const url = new URL(AFFILIATE_CV_ENDPOINT);
  url.searchParams.set("click_id", input.clickId);
  url.searchParams.set("txid", input.txid);
  const payoutVal =
    input.payout?.trim() ||
    process.env.AFFILIATE_CV_PAYOUT?.trim() ||
    process.env.NEXT_PUBLIC_AFFILIATE_CV_PAYOUT?.trim() ||
    "";
  if (payoutVal) url.searchParams.set("payout", payoutVal);
  return url.toString();
}
