import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { PersonaForm, emptyPersonaFormValues } from "@/components/admin/persona-form";

export const dynamic = "force-dynamic";

export default async function AdminNewPersonaPage() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.status === 401) redirect("/login?next=/admin/personas/new");
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
        <h1 className="text-lg font-semibold">Geen toegang</h1>
        <p className="mt-1 text-sm">{auth.error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <Link
            href="/admin/personas"
            className="text-xs text-gray-500 hover:text-gray-900"
          >
            ← Personas
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Nieuwe persona</h1>
          <p className="mt-1 text-sm text-gray-600">
            Vul minimaal naam, leeftijd, stad, bio en avatar in. De rest verfijnt
            de persona — backstory en persona-diepte voeden direct de AI-systeemprompt.
          </p>
        </div>
      </div>
      <PersonaForm mode="create" initial={emptyPersonaFormValues()} />
    </div>
  );
}
