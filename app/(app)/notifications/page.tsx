import Link from "next/link";

export default function NotificationsPage() {
  return (
    <div className="px-5 py-8">
      <h1 className="text-xl font-bold text-ink">Notifications</h1>
      <p className="mt-2 max-w-sm text-sm text-inkMuted">
        Placeholder — your alerts and activity will show up here.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-lavender px-5 py-3 text-sm font-bold text-primary ring-1 ring-primary/15"
      >
        Back to home
      </Link>
    </div>
  );
}
