import Link from "next/link";

export default function NewMessagePlaceholder() {
  return (
    <>
      <div className="flex flex-col gap-4 px-5 py-8">
        <h1 className="text-xl font-bold text-ink">New message</h1>
        <p className="text-sm text-inkMuted">
          Placeholder — pick a link or search to start a conversation.
        </p>
        <Link
          href="/messages"
          className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white shadow-pill"
        >
          Back to Messages
        </Link>
      </div>
    </>
  );
}
