import { HomeScreen } from "@/components/whisper/home-screen";
import { PostDiscoverToast } from "@/components/whisper/post-discover-toast";
import { fetchHomePageCatalogServer } from "@/lib/catalog/server-catalog";

export default async function DiscoverPage() {
  const catalog = await fetchHomePageCatalogServer();

  return (
    <>
      <PostDiscoverToast />
      <HomeScreen
        gridProfiles={catalog.gridProfiles}
        activityUsers={catalog.activityUsers}
        catalogDegraded={catalog.catalogDegraded}
      />
    </>
  );
}
