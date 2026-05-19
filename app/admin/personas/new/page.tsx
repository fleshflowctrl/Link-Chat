import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { PersonaForm } from "@/components/admin/persona-form";
import {
  emptyPersonaFormValues,
  emptyPersonaFormValuesForVariant,
} from "@/components/admin/persona-form/types";
import { parseAppVariant } from "@/lib/app-variant";
import { AdminPageHeader } from "@/components/admin/page-header";

export const dynamic = "force-dynamic";

export default async function AdminNewPersonaPage({
  searchParams,
}: {
  searchParams: { variant?: string };
}) {
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

  const variant = parseAppVariant(searchParams.variant ?? null);
  const initial =
    variant === "v2" ? emptyPersonaFormValuesForVariant("v2") : emptyPersonaFormValues();

  return (
    <div className="mx-auto max-w-7xl">
      <AdminPageHeader
        crumbs={[
          { href: "/admin/personas", label: "Personas" },
          { label: "Nieuw" },
        ]}
        title={variant === "v2" ? "Nieuwe v2 persona" : "Nieuwe persona"}
        description={
          variant === "v2"
            ? "FetLife/kink pool — alleen /v2/discover. Avatar en galerij gebruiken de nude template-pool (expliciet naakt)."
            : "Vul minimaal naam, leeftijd, stad, bio en avatar in. De rest verfijnt — backstory en persona-diepte voeden direct de AI-systeemprompt."
        }
      />
      <PersonaForm mode="create" initial={initial} />
    </div>
  );
}
