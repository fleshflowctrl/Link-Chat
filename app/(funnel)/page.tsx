import { redirect } from "next/navigation";
import { OnboardingFunnel } from "@/components/funnel/onboarding-funnel";
import { fetchFunnelCatalogProfilesServer } from "@/lib/catalog/server-catalog";
import { AffiliateClickCapture } from "@/components/analytics/affiliate-click-capture";
import { VisitorTracker } from "@/components/analytics/visitor-tracker";

type Props = {
  searchParams: { testFunnel?: string };
};

/** Default: discover. Funnel only via `/?testFunnel=1` (dev/preview). */
export default async function HomePage({ searchParams }: Props) {
  if (searchParams.testFunnel !== "1") {
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
