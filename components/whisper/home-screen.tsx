import type { NewWhisperUser } from "@/data/newUsers";
import type { Profile } from "@/data/profiles";
import { ActivityStrip } from "./activity-strip";
import { CatalogFallbackBanner } from "./catalog-fallback-banner";
import { HomeHeader } from "./home-header";
import { ProfileGrid } from "./profile-grid";

type Props = {
  gridProfiles: Profile[];
  activityUsers: NewWhisperUser[];
  credits: number;
  catalogDegraded: boolean;
};

export function HomeScreen({
  gridProfiles,
  activityUsers,
  credits,
  catalogDegraded,
}: Props) {
  return (
    <>
      <HomeHeader credits={credits} />
      <CatalogFallbackBanner show={catalogDegraded} />
      <ActivityStrip users={activityUsers} />
      <ProfileGrid profiles={gridProfiles} />
      <div className="h-6 shrink-0" aria-hidden />
    </>
  );
}
