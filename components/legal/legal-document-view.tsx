import Link from "next/link";
import type { LegalDocument } from "@/lib/legal/types";
import { LEGAL_PATHS, LEGAL_SITE_LABEL } from "@/lib/legal/constants";

export function LegalDocumentView({ doc }: { doc: LegalDocument }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-8 pb-16 sm:px-6">
      <header className="mb-8 border-b border-neutral-200 pb-6">
        <p className="text-sm font-medium text-primary">{doc.subtitle ?? LEGAL_SITE_LABEL}</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold text-neutral-900">
          {doc.title}
        </h1>
        <p className="mt-2 text-sm text-neutral-500">
          Laatst bijgewerkt: {doc.lastUpdated}
        </p>
        <nav className="mt-4 flex flex-wrap gap-3 text-sm">
          <Link href={LEGAL_PATHS.terms} className="text-primary underline-offset-2 hover:underline">
            Voorwaarden
          </Link>
          <Link href={LEGAL_PATHS.privacy} className="text-primary underline-offset-2 hover:underline">
            Privacy
          </Link>
          <Link href={LEGAL_PATHS.cookies} className="text-primary underline-offset-2 hover:underline">
            Cookies
          </Link>
          <Link href={LEGAL_PATHS.refund} className="text-primary underline-offset-2 hover:underline">
            Refund &amp; billing
          </Link>
        </nav>
      </header>

      <div className="space-y-8 text-[15px] leading-relaxed text-neutral-800">
        {doc.sections.map((section) => (
          <section key={section.id} id={section.id}>
            <h2 className="mb-3 text-lg font-semibold text-neutral-900">
              {section.title}
            </h2>
            {section.paragraphs.map((p, i) => (
              <p key={i} className="mb-3 last:mb-0">
                {p}
              </p>
            ))}
            {section.bullets && section.bullets.length > 0 && (
              <ul className="mt-2 list-disc space-y-2 pl-5">
                {section.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <p className="mt-10 text-xs text-neutral-500">
        Dit document is informatief en vervangt geen juridisch advies. Laat teksten door een
        advocaat controleren zodra bedrijfsgegevens definitief zijn.
      </p>
    </article>
  );
}
