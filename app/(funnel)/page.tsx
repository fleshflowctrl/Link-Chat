import { OnboardingFunnel } from "@/components/funnel/onboarding-funnel";
import { fetchFunnelCatalogProfilesServer } from "@/lib/catalog/server-catalog";
import { AffiliateClickCapture } from "@/components/analytics/affiliate-click-capture";
import { VisitorTracker } from "@/components/analytics/visitor-tracker";

export default async function FunnelEntryPage() {
  const { profiles: funnelCatalog } = await fetchFunnelCatalogProfilesServer();
  return (
    <>
      <VisitorTracker />
      <AffiliateClickCapture />
      <OnboardingFunnel initialCatalog={funnelCatalog} />
    </>
  );
}
