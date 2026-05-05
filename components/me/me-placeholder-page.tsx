import Link from "next/link";

type Props = {
  title: string;
  description?: string;
};

export function MePlaceholderPage({ title, description }: Props) {
  return (
    <div className="flex flex-col gap-4 px-5 py-8">
      <h1 className="text-xl font-bold text-ink">{title}</h1>
      {description && (
        <p className="text-sm text-inkMuted">{description}</p>
      )}
      <Link
        href="/me"
        className="inline-flex min-h-[44px] max-w-xs items-center justify-center rounded-2xl bg-lavender px-5 py-3 text-sm font-bold text-primary ring-1 ring-primary/15"
      >
        Terug naar profiel
      </Link>
    </div>
  );
}
