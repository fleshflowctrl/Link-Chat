import { LegalDocumentView } from "@/components/legal/legal-document-view";
import { termsNl } from "@/lib/legal/content/terms-nl";
import { SITE_TITLE } from "@/lib/brand";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: `Algemene voorwaarden — ${SITE_TITLE}`,
};

export default function TermsPage() {
  return <LegalDocumentView doc={termsNl} />;
}
