import { OnboardingFunnel } from "@/components/funnel/onboarding-funnel";
import { fetchFunnelCatalogProfilesServer } from "@/lib/catalog/server-catalog";
import { AffiliateClickCapture } from "@/components/analytics/affiliate-click-capture";
import { VisitorTracker } from "@/components/analytics/visitor-tracker";

export default async function FunnelEntryPage() {
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
