import Link from "next/link";

export default function LinksAllPage() {
  return (
    <div className="min-h-0 bg-[#F5F3EE] px-5 py-8">
      <h1 className="text-xl font-bold text-ink">All links</h1>
      <p className="mt-2 max-w-sm text-sm text-inkMuted">
        Full directory is coming soon. For now, browse your links on the main
        Links tab.
      </p>
      <Link
        href="/links"
        className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-lavender px-5 py-3 text-sm font-bold text-primary ring-1 ring-primary/15"
      >
        Back to Links
      </Link>
    </div>
  );
}
