import Link from "next/link";

export default function ProfileNotFound() {
  return (
    <div className="flex flex-col items-center gap-4 px-5 py-16 text-center">
      <h1 className="text-xl font-bold text-ink">Profile not found</h1>
      <p className="text-sm text-inkMuted">
        This person isn&apos;t in your discover list.
      </p>
      <Link
        href="/"
        className="rounded-full bg-primary px-6 py-3 text-sm font-bold text-white shadow-pill"
      >
        Back to Discover
      </Link>
    </div>
  );
}
