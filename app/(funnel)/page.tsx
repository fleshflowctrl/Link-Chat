import { redirect } from "next/navigation";
import { OnboardingFunnel } from "@/components/funnel/onboarding-funnel";
import { fetchFunnelCatalogProfilesServer } from "@/lib/catalog/server-catalog";
import { AffiliateClickCapture } from "@/components/analytics/affiliate-click-capture";
import { VisitorTracker } from "@/components/analytics/visitor-tracker";
import { getViewerIsPermanentServer } from "@/lib/auth/viewer-server";

/** New visitors land on the onboarding funnel; returning logged-in users skip to discover. */
export default async function HomePage() {
  if (await getViewerIsPermanentServer()) {
    redirect("/discover");
  }

  const { profiles: funnelCatalog } = await fetchFunnelCatalogProfilesServer({
    variant: "v2",
  });

  return (
    <>
      <VisitorTracker variant="v2" />
      <AffiliateClickCapture />
      <OnboardingFunnel initialCatalog={funnelCatalog} variant="v2" />
    </>
  );
}
