import Link from "next/link";

export default function MeSettingsPage() {
  return (
    <div className="min-h-0 bg-[#F5F3EE] px-5 py-8">
      <h1 className="text-xl font-bold text-ink">Instellingen</h1>
      <p className="mt-2 max-w-sm text-sm text-gray-500">
        Het centrale instellingencentrum komt eraan. Gebruik voorlopig de secties
        op je profiel.
      </p>
      <Link
        href="/me"
        className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-lavender px-5 py-3 text-sm font-bold text-primary ring-1 ring-primary/15"
      >
        Terug naar profiel
      </Link>
    </div>
  );
}
