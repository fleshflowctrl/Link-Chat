import { HomeScreen } from "@/components/whisper/home-screen";
import { fetchHomePageCatalogServer } from "@/lib/catalog/server-catalog";
import { fetchUserCreditsServer } from "@/lib/me/server-profile";

export default async function Home() {
  const [catalog, credits] = await Promise.all([
    fetchHomePageCatalogServer(),
    fetchUserCreditsServer(),
  ]);

  return (
    <HomeScreen
      gridProfiles={catalog.gridProfiles}
      activityUsers={catalog.activityUsers}
      credits={credits}
      catalogDegraded={catalog.catalogDegraded}
    />
  );
}
