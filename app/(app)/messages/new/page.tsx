import Link from "next/link";

export default function NewMessagePlaceholder() {
  return (
    <>
      <div className="flex flex-col gap-4 px-5 py-8">
        <h1 className="text-xl font-bold text-ink">Nieuw bericht</h1>
        <p className="text-sm text-inkMuted">
          Tijdelijke pagina — kies een koppeling of zoek om een gesprek te starten.
        </p>
        <Link
          href="/messages"
          className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-pill"
        >
          Terug naar berichten
        </Link>
      </div>
    </>
  );
}
