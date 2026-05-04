import { OnlineNowRail } from "@/components/OnlineNowRail";
import { ActivityStrip } from "./activity-strip";
import { HomeHeader } from "./home-header";
import { ProfileGrid } from "./profile-grid";

export function HomeScreen() {
  return (
    <>
      <HomeHeader />
      <OnlineNowRail />
      <ActivityStrip />
      <ProfileGrid />
      <div className="h-6 shrink-0" aria-hidden />
    </>
  );
}
