import Link from "next/link";

export default function ProfileNotFound() {
  return (
    <div className="flex flex-col items-center gap-4 px-5 py-16 text-center">
      <h1 className="text-xl font-bold text-ink">Profiel niet gevonden</h1>
      <p className="text-sm text-inkMuted">
        Deze persoon staat niet in je ontdeklijst.
      </p>
      <Link
        href="/discover"
        className="rounded-full bg-primary px-6 py-3 text-sm font-bold text-white shadow-pill"
      >
        Terug naar ontdekken
      </Link>
    </div>
  );
}
