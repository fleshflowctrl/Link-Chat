import { OnboardingFunnel } from "@/components/funnel/onboarding-funnel";
import { fetchFunnelCatalogProfilesServer } from "@/lib/catalog/server-catalog";

export default async function FunnelEntryPage() {
  const { profiles: funnelCatalog } = await fetchFunnelCatalogProfilesServer();
  return <OnboardingFunnel initialCatalog={funnelCatalog} />;
}
