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
    <div className="flex min-h-dvh flex-col bg-neutral-50">
      <header className="shrink-0 border-b border-neutral-200 bg-white pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-4 sm:py-3">
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold text-neutral-900 sm:text-lg">
              Operator inbox
            </h1>
            <p className="text-[11px] text-neutral-500 sm:text-xs">
              Handmatige antwoorden
              {isManualOperatorMode() ? " · manual mode" : ""}
            </p>
          </div>
          <nav className="flex shrink-0 gap-4 text-sm">
            <Link
              href="/operator/inbox"
              className="min-h-[44px] flex items-center font-medium text-primary"
            >
              Inbox
            </Link>
            <Link
              href="/admin"
              className="min-h-[44px] flex items-center text-neutral-600"
            >
              Admin
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto flex w-full min-h-0 max-w-7xl flex-1 flex-col px-2 py-2 sm:px-4 sm:py-4 lg:py-6">
        {children}
      </main>
    </div>
  );
}
