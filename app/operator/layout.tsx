import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";

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
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-neutral-100">
      <main className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-1 flex-col overflow-hidden lg:max-w-6xl">
        {children}
      </main>
    </div>
  );
}
