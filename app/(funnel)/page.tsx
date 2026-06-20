import { redirect } from "next/navigation";
import { OnboardingFunnel } from "@/components/funnel/onboarding-funnel";
import { fetchFunnelCatalogProfilesServer } from "@/lib/catalog/server-catalog";
import { getViewerIsPermanentServer } from "@/lib/auth/viewer-server";

/** Visitors land on Discover; admin can still open `/?testFunnel=1` to preview onboarding. */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ testFunnel?: string }>;
}) {
  const { testFunnel } = await searchParams;
  if (testFunnel !== "1") {
    redirect("/discover");
  }

  if (await getViewerIsPermanentServer()) {
    redirect("/discover");
  }

  const { profiles: funnelCatalog } = await fetchFunnelCatalogProfilesServer({
    variant: "v2",
  });

  return (
    <OnboardingFunnel initialCatalog={funnelCatalog} variant="v2" />
  );
}
