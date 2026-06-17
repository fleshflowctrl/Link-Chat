import { EditProfileView } from "@/components/me/edit-profile-view";
import { fetchUserEditProfileServer } from "@/lib/me/server-profile";

export default async function MePage() {
  const { profile, syncToken, isAdmin } = await fetchUserEditProfileServer();
  return (
    <EditProfileView
      initialProfile={profile}
      syncToken={syncToken}
      isTabRoot
      isAdmin={isAdmin}
    />
  );
}
