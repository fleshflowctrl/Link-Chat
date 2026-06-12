import { HomeScreen } from "@/components/whisper/home-screen";
import { APP_PAGE_PADDING_X } from "@/lib/responsive-shell";
import { PostDiscoverToast } from "@/components/whisper/post-discover-toast";
import { fetchHomePageCatalogServer } from "@/lib/catalog/server-catalog";
import { fetchUserProfileServerOptional } from "@/lib/me/server-profile";

export default async function DiscoverPage() {
  const [catalog, initialProfile] = await Promise.all([
    fetchHomePageCatalogServer({ variant: "v2" }),
    fetchUserProfileServerOptional(),
  ]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <PostDiscoverToast />
      <div
        className={`shrink-0 border-b border-[#B52B2A]/25 bg-[#1D1D1E]/95 py-2 text-center text-[11px] font-medium tracking-wide text-[#B52B2A] ${APP_PAGE_PADDING_X}`}
      >
        Discreet · Geverifieerd · Alleen 18+
      </div>
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
      />
    </div>
  );
}
