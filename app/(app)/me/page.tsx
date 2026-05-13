import { MeProfileView } from "@/components/me/me-profile-view";
import { fetchUserEditProfileServer } from "@/lib/me/server-profile";

export default async function MePage() {
  const { profile, syncToken, stats, showVerified } =
    await fetchUserEditProfileServer();
  return (
    <MeProfileView
      initialProfile={profile}
      syncToken={syncToken}
      stats={stats}
      showVerified={showVerified}
    />
  );
}
