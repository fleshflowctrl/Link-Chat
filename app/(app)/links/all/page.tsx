import Link from "next/link";

export default function LinksAllPage() {
  return (
    <div className="min-h-0 bg-[#F5F3EE] px-5 py-8">
      <h1 className="text-xl font-bold text-ink">Alle koppelingen</h1>
      <p className="mt-2 max-w-sm text-sm text-inkMuted">
        De volledige lijst komt eraan. Tot die tijd zie je je koppelingen op het
        tabblad Koppelingen.
      </p>
      <Link
        href="/links"
        className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-lavender px-5 py-3 text-sm font-bold text-primary ring-1 ring-primary/15"
      >
        Terug naar koppelingen
      </Link>
    </div>
  );
}
