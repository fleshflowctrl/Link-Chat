import { LegalDocumentView } from "@/components/legal/legal-document-view";
import { privacyNl } from "@/lib/legal/content/privacy-nl";
import { SITE_TITLE } from "@/lib/brand";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: `Privacybeleid — ${SITE_TITLE}`,
};

export default function PrivacyPage() {
  return <LegalDocumentView doc={privacyNl} />;
}
