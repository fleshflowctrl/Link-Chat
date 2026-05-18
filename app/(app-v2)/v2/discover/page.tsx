import { HomeScreen } from "@/components/whisper/home-screen";
import { PostDiscoverToast } from "@/components/whisper/post-discover-toast";
import { fetchHomePageCatalogServer } from "@/lib/catalog/server-catalog";
import { fetchUserProfileServerOptional } from "@/lib/me/server-profile";

export default async function V2DiscoverPage() {
  const [catalog, initialProfile] = await Promise.all([
    fetchHomePageCatalogServer({ variant: "v2" }),
    fetchUserProfileServerOptional(),
  ]);

  return (
    <>
      <div className="border-b border-[#c9a227]/15 bg-[#141210]/90 px-4 py-2 text-center text-[11px] font-medium tracking-wide text-[#c9a227]/90">
        Discreet · Geverifieerd · Alleen 18+
      </div>
      <PostDiscoverToast />
      <HomeScreen
        gridProfiles={catalog.gridProfiles}
        activityUsers={catalog.activityUsers}
        catalogDegraded={catalog.catalogDegraded}
        initialProfile={initialProfile}
        feedSlot={catalog.feedSlot}
        nextRefreshAt={catalog.nextRefreshAt}
        refreshCost={catalog.refreshCost}
        feedHash={catalog.feedHash}
      />
    </>
  );
}
