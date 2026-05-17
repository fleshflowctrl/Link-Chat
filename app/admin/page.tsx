import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";

/** Default admin entry: metrics dashboard. */
export default async function AdminIndexPage() {
  const auth = await requireAdmin();
  if (!auth.ok) {
    if (auth.status === 401) redirect("/login?next=/admin");
    redirect("/discover");
  }
  redirect("/admin/metrics");
}
