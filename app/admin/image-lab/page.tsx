import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ImageLab } from "@/components/admin/image-lab";

export const dynamic = "force-dynamic";

export default async function AdminImageLabPage() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.status === 401) redirect("/login?next=/admin/image-lab");
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
        <h1 className="text-lg font-semibold">Geen toegang</h1>
        <p className="mt-1 text-sm">{auth.error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        crumbs={[{ label: "Admin" }, { label: "Image lab" }]}
        title="Image lab"
        description={
          <>
            Test prompts direct tegen Z-Image-Turbo. Vergelijk{" "}
            <em>rauwe output</em> met de phone-finish pass, tune steps en
            resolutie, en vind de baseline die stabiel én realistisch is.
          </>
        }
      />
      <ImageLab />
    </div>
  );
}
