import { HomeScreen } from "@/components/whisper/home-screen";
import { PostDiscoverToast } from "@/components/whisper/post-discover-toast";
import { fetchHomePageCatalogServer } from "@/lib/catalog/server-catalog";
import { fetchUserCreditsServer } from "@/lib/me/server-profile";

export default async function DiscoverPage() {
  const [catalog, credits] = await Promise.all([
    fetchHomePageCatalogServer(),
    fetchUserCreditsServer(),
  ]);

  return (
    <>
      <PostDiscoverToast />
      <HomeScreen
        gridProfiles={catalog.gridProfiles}
        activityUsers={catalog.activityUsers}
        credits={credits}
        catalogDegraded={catalog.catalogDegraded}
      />
    </>
  );
}
