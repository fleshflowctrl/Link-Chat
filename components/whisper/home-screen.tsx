import { ActivityStrip } from "./activity-strip";
import { HomeHeader } from "./home-header";
import { ProfileGrid } from "./profile-grid";
import { StoriesRail } from "./stories-rail";

export function HomeScreen() {
  return (
    <>
      <HomeHeader />
      <StoriesRail />
      <ActivityStrip />
      <ProfileGrid />
      <div className="h-6 shrink-0" aria-hidden />
    </>
  );
}
