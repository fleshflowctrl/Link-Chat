import Link from "next/link";

type Props = { params: { id: string } };

export default function MessageThreadPlaceholder({ params }: Props) {
  return (
    <>
      <div className="flex flex-col gap-4 px-5 py-8">
        <h1 className="text-xl font-bold text-ink">Chat</h1>
        <p className="text-sm text-inkMuted">
          Placeholder thread for <span className="font-semibold">{params.id}</span>
          . Wire real chat UI here later.
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
