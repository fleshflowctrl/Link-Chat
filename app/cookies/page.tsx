import { LegalDocumentView } from "@/components/legal/legal-document-view";
import { cookiesNl } from "@/lib/legal/content/cookies-nl";
import { SITE_TITLE } from "@/lib/brand";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: `Cookiebeleid — ${SITE_TITLE}`,
};

export default function CookiesPage() {
  return <LegalDocumentView doc={cookiesNl} />;
}
