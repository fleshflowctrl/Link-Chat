import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { PersonaForm } from "@/components/admin/persona-form";
import { emptyPersonaFormValues } from "@/components/admin/persona-form/types";
import { AdminPageHeader } from "@/components/admin/page-header";

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
    <div className="mx-auto max-w-7xl">
      <AdminPageHeader
        crumbs={[
          { href: "/admin/personas", label: "Personas" },
          { label: "Nieuw" },
        ]}
        title="Nieuwe persona"
        description="Vul minimaal naam, leeftijd, stad, bio en avatar in. De rest verfijnt — backstory en persona-diepte voeden direct de AI-systeemprompt en maken haar herkenbaar als een echt persoon."
      />
      <PersonaForm mode="create" initial={emptyPersonaFormValues()} />
    </div>
  );
}
