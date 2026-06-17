import { LegalDocumentView } from "@/components/legal/legal-document-view";
import { refundBillingNl } from "@/lib/legal/content/refund-billing-nl";
import { SITE_TITLE } from "@/lib/brand";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: `Refund & Billing Policy — ${SITE_TITLE}`,
};

export default function RefundBillingPage() {
  return <LegalDocumentView doc={refundBillingNl} />;
}
