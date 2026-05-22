import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { isManualOperatorMode } from "@/lib/manual-operator-mode";

export default async function OperatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.status === 401) redirect("/login?next=/operator/inbox");
    return (
      <div className="mx-auto max-w-lg p-8 text-red-800">
        Geen toegang: {auth.error}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">Operator inbox</h1>
            <p className="text-xs text-neutral-500">
              Handmatige antwoorden namens personas
              {isManualOperatorMode() ? " · MANUAL_OPERATOR_MODE actief" : ""}
            </p>
          </div>
          <nav className="flex gap-3 text-sm">
            <Link href="/operator/inbox" className="text-primary hover:underline">
              Inbox
            </Link>
            <Link href="/admin" className="text-neutral-600 hover:underline">
              Admin
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
