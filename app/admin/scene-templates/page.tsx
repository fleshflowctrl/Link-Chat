import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/require-admin";
import { AdminPageHeader } from "@/components/admin/page-header";
import { SceneTemplatesPage } from "@/components/admin/scene-templates-page";

export const dynamic = "force-dynamic";

export default async function AdminSceneTemplatesPage() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.status === 401) redirect("/login?next=/admin/scene-templates");
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
        crumbs={[{ label: "Admin" }, { label: "Scene templates" }]}
        title="Scene templates"
        description={
          <>
            Beheer de scenebibliotheek die de persona-foto generator gebruikt.{" "}
            <span className="text-gray-500">
              Klik op "50 nieuwe genereren" om Grok een batch te laten schrijven, en
              gebruik de reject-knop met reden om Grok te leren wat je niet wilt.
            </span>
          </>
        }
      />

      <SceneTemplatesPage />
    </div>
  );
}
