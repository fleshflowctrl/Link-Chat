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
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
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
        fitViewport
        trustStrip="Discreet · Geverifieerd · Alleen 18+"
      />
    </div>
  );
}
