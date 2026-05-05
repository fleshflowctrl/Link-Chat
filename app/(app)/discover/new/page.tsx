import Link from "next/link";

export default function DiscoverNewPage() {
  return (
    <div className="px-5 py-8">
      <h1 className="text-xl font-bold text-ink">Nieuw op whisper</h1>
      <p className="mt-2 max-w-sm text-sm text-inkMuted">
        De volledige ontdek-feed komt eraan. Tot die tijd vind je nieuwe gezichten
        op de startpagina.
      </p>
      <Link
        href="/discover"
        className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-lavender px-5 py-3 text-sm font-bold text-primary ring-1 ring-primary/15"
      >
        Terug naar home
      </Link>
    </div>
  );
}
